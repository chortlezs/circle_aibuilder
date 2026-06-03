import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';

const EVALUATION_THRESHOLD = 5; // 监测到 5 次动作后进行结算
const DISSOLVE_DURATION_MS = 2800;

export const useNarrative = () => {
  const { 
    setMindfulnessState,
    appPhase, setAppPhase,
    behaviorHistory, clearBehaviorHistory,
    narrativeStep, setNarrativeStep,
    narrativePressCount, setNarrativePressCount,
    guideAudioPending, setGuideAudioPending,
    guideAdvancePending, setGuideAdvancePending,
    activeTab,
    currentPressure,
    addRecord
  } = useAppStore();

  const sessionStartRef = useRef<number>(0);
  const isSessionActiveRef = useRef<boolean>(false);

  const finishSession = useCallback((success: boolean) => {
    if (!isSessionActiveRef.current) return;
    
    const duration = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    const startState = useAppStore.getState().mindfulnessState;
    
    addRecord({
      id: Date.now().toString(),
      timestamp: Date.now(),
      duration,
      startState: startState,
      endState: success ? 'positive' : 'negative',
      negativeCount: 0,
      successTransform: success
    });
    
    isSessionActiveRef.current = false;
    // 保持当前的 UI 状态，不在这里重置，以便用户能一直看到“正念完成”
  }, [addRecord]);

  // 1. 监测阶段 -> 评估阶段
  useEffect(() => {
    if (activeTab === 'monitor' && appPhase === 'monitoring' && behaviorHistory.length >= EVALUATION_THRESHOLD) {
      let score = 0;
      behaviorHistory.forEach(behavior => {
        if (behavior === 'light_press') score += 1; 
        else if (behavior === 'normal_press') score += 0; 
        else if (behavior === 'hard_press') score -= 1; 
      });

      // 稍微延迟状态更新，避免和 UI 动画冲突导致渲染崩溃
      setTimeout(() => {
        setAppPhase('evaluating');
        setMindfulnessState(score < 0 ? 'negative' : 'positive');
      }, 100);
    }
  }, [appPhase, activeTab, behaviorHistory, clearBehaviorHistory, setAppPhase, setMindfulnessState]);

  // 2. 处理 Tab 切换：进入 guide 启动叙事，离开则取消
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const currentPhase = useAppStore.getState().appPhase;

    if (activeTab === 'guide') {
      if (currentPhase !== 'narrative' && currentPhase !== 'dissolving' && currentPhase !== 'complete') {
        setAppPhase('narrative');
        setNarrativeStep(0); // 先显示“准备中”
        setNarrativePressCount(0);
        setGuideAudioPending(false);
        setGuideAdvancePending(false);
        sessionStartRef.current = Date.now();
        isSessionActiveRef.current = true;
        
        // 延迟一小段时间后进入正式的第一步
        timeoutId = setTimeout(() => {
          if (useAppStore.getState().activeTab === 'guide') {
            setNarrativeStep(1);
          }
        }, 1500);
      }
    } else if (activeTab === 'monitor') {
      if (currentPhase === 'narrative' || currentPhase === 'dissolving' || currentPhase === 'complete') {
        if (isSessionActiveRef.current) finishSession(false);
        setNarrativeStep(0);
        setGuideAudioPending(false);
        setGuideAdvancePending(false);
        setAppPhase('idle');
        setMindfulnessState('idle');
        clearBehaviorHistory();
      }
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [
    activeTab,
    clearBehaviorHistory,
    finishSession,
    setAppPhase,
    setMindfulnessState,
    setGuideAdvancePending,
    setGuideAudioPending,
    setNarrativePressCount,
    setNarrativeStep,
  ]);

  // 3. 叙事阶段：监听行为 (按一下、按三下)
  const prevHistoryLen = useRef(behaviorHistory.length);
  useEffect(() => {
    if (activeTab !== 'guide') {
      prevHistoryLen.current = behaviorHistory.length;
      return;
    }

    const newPresses = behaviorHistory.length - prevHistoryLen.current;
    prevHistoryLen.current = behaviorHistory.length;

    if (newPresses > 0) {
      const currentStep = Number(narrativeStep);
      const inputLocked = guideAudioPending && currentStep !== 3;

      if (inputLocked) {
        return;
      }
      
      if (currentStep === 1) {
        setGuideAudioPending(false);
        setGuideAdvancePending(false);
        setNarrativeStep(2);
      } else if (currentStep === 2) {
        // 只要按了就可以进入下一步，不需要非得长按 3 秒
        setGuideAudioPending(false);
        setGuideAdvancePending(false);
        setNarrativeStep(3);
        setNarrativePressCount(0);
      } else if (currentStep === 3) {
        const newCount = narrativePressCount + newPresses;
        if (newCount < 3) {
          setNarrativePressCount(newCount);
        } else {
          setNarrativePressCount(3);
          if (guideAudioPending) {
            setGuideAdvancePending(true);
          } else if (!guideAdvancePending) {
            setTimeout(() => setNarrativeStep(4), 500); // 稍微延迟一下进入第四步
          }
        }
      }
    }
  }, [
    activeTab,
    behaviorHistory.length,
    guideAdvancePending,
    guideAudioPending,
    narrativePressCount,
    narrativeStep,
    setGuideAdvancePending,
    setGuideAudioPending,
    setNarrativePressCount,
    setNarrativeStep,
  ]);

  // 4. 叙事阶段：监听压力 (缓缓松开)
  useEffect(() => {
    if (activeTab !== 'guide') return;
    if (guideAudioPending) return;

    if (narrativeStep === 4) {
      if (currentPressure === 0) {
        // 松开后稍微延迟，再进入压力云消散动画。
        const t = setTimeout(() => {
          setNarrativeStep(5);
          setAppPhase('dissolving');
        }, 2500); // 增加这里的延迟，确保第四步的文字能和语音同步停留足够长的时间
        return () => {
          clearTimeout(t);
        };
      }
    }
  }, [activeTab, narrativeStep, guideAudioPending, currentPressure, setAppPhase, setNarrativeStep]);

  // 5. 云消散动画结束后进入完成态，再由 Home 页负责停顿 2 秒回到角色选择页。
  useEffect(() => {
    if (appPhase !== 'dissolving') {
      return;
    }

    const timer = setTimeout(() => {
      finishSession(true);
      setAppPhase('complete');
    }, DISSOLVE_DURATION_MS);

    return () => clearTimeout(timer);
  }, [appPhase, finishSession, setAppPhase]);

  const cancelSession = () => {
    if (isSessionActiveRef.current) {
      finishSession(false);
    }
  };

  // 组件卸载时（离开页面时）重置状态
  useEffect(() => {
    return () => {
      const state = useAppStore.getState();
      if (isSessionActiveRef.current) {
        isSessionActiveRef.current = false;
      }
      state.setNarrativeStep(0);
      state.setGuideAudioPending(false);
      state.setGuideAdvancePending(false);
      state.setAppPhase('idle');
      state.setMindfulnessState('idle');
      state.clearBehaviorHistory();
    };
  }, []);

  return { cancelSession };
};
