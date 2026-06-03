import { useCallback, useRef } from 'react';
import { useAppStore, BehaviorType } from '../store/appStore';

// Web Bluetooth API types (partial) for TypeScript
declare global {
  interface Navigator {
    bluetooth: {
      requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
    };
  }
  
  interface RequestDeviceOptions {
    filters?: Array<{ services?: string[]; name?: string; namePrefix?: string }>;
    optionalServices?: string[];
    acceptAllDevices?: boolean;
  }
  
  interface BluetoothDevice extends EventTarget {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
    watchAdvertisements(): Promise<void>;
    unwatchAdvertisements(): void;
    watchingAdvertisements: boolean;
  }
  
  interface BluetoothRemoteGATTServer {
    connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
    getPrimaryServices(service?: string): Promise<BluetoothRemoteGATTService[]>;
  }

  interface BluetoothRemoteGATTService {
    uuid: string;
    isPrimary: boolean;
    device: BluetoothDevice;
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
    getCharacteristics(characteristic?: string): Promise<BluetoothRemoteGATTCharacteristic[]>;
  }

  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    uuid: string;
    service: BluetoothRemoteGATTService;
    properties: BluetoothCharacteristicProperties;
    value?: DataView;
    getDescriptor(descriptor: string): Promise<BluetoothRemoteGATTDescriptor>;
    getDescriptors(descriptor?: string): Promise<BluetoothRemoteGATTDescriptor[]>;
    readValue(): Promise<DataView>;
    writeValue(value: BufferSource): Promise<void>;
    writeValueWithResponse(value: BufferSource): Promise<void>;
    writeValueWithoutResponse(value: BufferSource): Promise<void>;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  }

  interface BluetoothCharacteristicProperties {
    broadcast: boolean;
    read: boolean;
    writeWithoutResponse: boolean;
    write: boolean;
    notify: boolean;
    indicate: boolean;
    authenticatedSignedWrites: boolean;
    reliableWrite: boolean;
    writableAuxiliaries: boolean;
  }

  interface BluetoothRemoteGATTDescriptor {
    uuid: string;
    characteristic: BluetoothRemoteGATTCharacteristic;
    value?: DataView;
    readValue(): Promise<DataView>;
    writeValue(value: BufferSource): Promise<void>;
  }
}

const ESP32_DEVICE_NAME = 'FSR_WAVE_C6';
const ESP32_SERVICE_UUID = '7b9a0001-9f46-4bdf-a4d8-8a5c2c9f0001';
const ESP32_LEVEL_CHARACTERISTIC_UUID = '7b9a0002-9f46-4bdf-a4d8-8a5c2c9f0001';

export const useBluetooth = () => {
  const { setDeviceStatus, setCurrentBehavior } = useAppStore();
  const deviceRef = useRef<BluetoothDevice | null>(null);

  const parseBleData = useCallback((data: string) => {
    const { addBehaviorToHistory, appPhase, setAppPhase, activeTab, setCurrentPressure } = useAppStore.getState();
    
    // 如果当前处于空闲状态且在监测页，收到数据就开始监测
    if (appPhase === 'idle' && activeTab === 'monitor') {
      setAppPhase('monitoring');
    }

    try {
      // 兼容 JSON 格式和纯数字字符串
      let behavior: BehaviorType = 'idle';
      let pressureVal = 0.5;

      const strValue = data.trim();

      // 解析硬件发送的 1, 2, 3
      if (strValue === '1') {
        behavior = 'light_press';
        pressureVal = 0.2; // 视觉映射用的相对压力
      } else if (strValue === '2') {
        behavior = 'normal_press';
        pressureVal = 0.5;
      } else if (strValue === '3') {
        behavior = 'hard_press';
        pressureVal = 0.9;
      } else if (strValue === '0') {
        behavior = 'idle';
        pressureVal = 0;
      } else {
        // 兼容原有的 JSON 格式
        try {
          const parsed = JSON.parse(data);
          if (parsed.pressure !== undefined) {
            pressureVal = parsed.pressure;
          }
          if (parsed.behavior) {
            behavior = parsed.behavior;
          }
        } catch {
          // ignore
        }
      }
      
      setCurrentPressure(pressureVal);
      
      // 评估期不接收新动作；历史里只记录有效按压，不记录松手 idle。
      if (appPhase !== 'evaluating') {
        setCurrentBehavior(behavior);
        if (behavior !== 'idle') {
          addBehaviorToHistory(behavior);
        }
      }
    } catch (e) {
      console.error("BLE Parse Error", e);
    }
  }, [setCurrentBehavior]);

  const connect = useCallback(async () => {
    try {
      if (!navigator.bluetooth) {
        alert('您的浏览器不支持蓝牙连接 (Web Bluetooth API)。请使用 Chrome 或 Edge 浏览器，并确保在 localhost 或 HTTPS 协议下运行。');
        return;
      }

      setDeviceStatus('connecting');
      console.log('Requesting Bluetooth Device...');
      
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: ESP32_DEVICE_NAME },
          { services: [ESP32_SERVICE_UUID] },
        ],
        optionalServices: [ESP32_SERVICE_UUID],
      });

      deviceRef.current = device;
      console.log('Connecting to GATT Server...');
      
      const server = await device.gatt?.connect();
      if (!server) throw new Error('Cannot connect to GATT Server');

      console.log('Getting ESP32 pressure service...');
      const service = await server.getPrimaryService(ESP32_SERVICE_UUID);
      console.log(`Using Service: ${service.uuid}`);

      const characteristic = await service.getCharacteristic(ESP32_LEVEL_CHARACTERISTIC_UUID);
      console.log(`Using Characteristic: ${characteristic.uuid}`);

      console.log('Starting Notifications...');
      await characteristic.startNotifications();

      characteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic | null;
        const value = target?.value;
        if (!value) return;
        // 假设设备端直接传回行为状态的字符串或特定编码
        // 这里做一个简单的模拟解析：
        const decoder = new TextDecoder('utf-8');
        const strValue = decoder.decode(value);
        
        parseBleData(strValue);
      });

      device.addEventListener('gattserverdisconnected', () => {
        console.log('Device disconnected');
        setDeviceStatus('disconnected');
      });

      setDeviceStatus('connected');
    } catch (error: unknown) {
      const bluetoothError = error instanceof Error ? error : new Error('未知错误');
      console.error('Bluetooth Error:', error);
      
      // 检查错误类型并给出更友好的提示
      if (bluetoothError.name === 'NotFoundError') {
        // 用户点击了取消配对，不需要弹窗报错，静默失败即可
        console.log('用户取消了蓝牙配对');
      } else if (bluetoothError.name === 'NotSupportedError') {
        alert('当前环境不支持蓝牙，请确保网站使用 HTTPS，或者您在本地 (localhost) 运行。');
      } else if (bluetoothError.name === 'NetworkError') {
        alert('蓝牙连接已断开，请检查设备是否开启。');
      } else if (bluetoothError.message.includes('No Services matching UUID')) {
        alert(`没有在设备上找到 ESP32 压力服务 (${ESP32_SERVICE_UUID})，请确认连接的是 ${ESP32_DEVICE_NAME} 且固件已烧录最新版本。`);
      } else if (bluetoothError.message.includes('No services found')) {
        alert('该设备似乎没有提供可用的蓝牙服务，请确保您连接的是正确的“AI Builder”硬件。');
      } else {
        alert(`蓝牙连接失败: ${bluetoothError.message || '未知错误'}`);
      }
      
      setDeviceStatus('disconnected');
    }
  }, [parseBleData, setDeviceStatus]);

  const disconnect = useCallback(() => {
    if (deviceRef.current?.gatt?.connected) {
      deviceRef.current.gatt.disconnect();
    }
  }, []);

  // 模拟蓝牙数据接收
  const simulateData = useCallback((behavior: BehaviorType, pressure: number = 0.5, duration: number = 400) => {
    const { addBehaviorToHistory, appPhase, setAppPhase, activeTab, setCurrentPressure } = useAppStore.getState();

    // 模拟压力值
    setCurrentPressure(pressure);
    
    // 延迟恢复压力值，模拟真实按压的持续时间
    setTimeout(() => {
      useAppStore.getState().setCurrentPressure(0);
    }, duration);

    // 在行为监测页且处于闲置状态时，触发开始监测
    if (appPhase === 'idle' && activeTab === 'monitor') {
      setAppPhase('monitoring');
    }

    // 在评估期间不再记录新的行为
    if (appPhase !== 'evaluating') {
      setCurrentBehavior(behavior);
      addBehaviorToHistory(behavior);
    }
  }, [setCurrentBehavior]);

  return {
    connect,
    disconnect,
    simulateData,
  };
};
