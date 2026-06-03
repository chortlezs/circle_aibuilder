import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useNarrative } from '../hooks/useNarrative';
import { Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { CloudDissolveOverlay } from '../components/CloudDissolveOverlay';

export const Home = () => {
  const navigate = useNavigate();
  const { 
    currentRole, 
    activeTab,
    setActiveTab,
    appPhase,
    mindfulnessState, 
    narrativeStep,
    narrativePressCount,
    currentBehavior,
    behaviorHistory,
    setCurrentBehavior,
    setCurrentPressure,
    guideAudioPending,
    setGuideAudioPending,
    setGuideAdvancePending
  } = useAppStore();
  
  useNarrative(); // Activate narrative hook
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const bgmRef = useRef<HTMLAudioElement>(null);

  // 控制背景音乐：角色页不播；流程内持续播放，步骤语音播放时暂停。
  useEffect(() => {
    const bgm = bgmRef.current;
    const guideAudioActive = activeTab === 'guide' && narrativeStep >= 1 && narrativeStep <= 4 && guideAudioPending;
    const shouldPlayBgm =
      !isMuted &&
      !guideAudioActive &&
      appPhase !== 'dissolving' &&
      (activeTab === 'monitor' || activeTab === 'guide');

    if (!bgm) {
      return;
    }

    bgm.muted = isMuted;

    if (shouldPlayBgm) {
      bgm.play().catch(err => console.log('BGM播放失败(需用户交互)', err));
    } else {
      bgm.pause();
      bgm.currentTime = 0;
    }
  }, [activeTab, appPhase, guideAudioPending, isMuted, narrativeStep]);

  // 监听 guideStep 变化播放对应的语音；播放期间暂停 BGM，结束后由 BGM effect 恢复。
  useEffect(() => {
    const guideAudio = audioRef.current;
    const bgm = bgmRef.current;
    const shouldPlayStepAudio = activeTab === 'guide' && narrativeStep >= 1 && narrativeStep <= 4 && !isMuted;

    if (!guideAudio) {
      return;
    }

    if (!shouldPlayStepAudio) {
      guideAudio.pause();
      guideAudio.removeAttribute('src');
      guideAudio.load();
      setGuideAudioPending(false);
      return;
    }

    bgm?.pause();
    if (bgm) bgm.currentTime = 0;

    setGuideAudioPending(true);
    setGuideAdvancePending(false);
    guideAudio.muted = isMuted;
    guideAudio.src = `/audio/step${narrativeStep}.mp3`;
    guideAudio.currentTime = 0;

    let settled = false;
    const releaseGuideAudioLock = () => {
      if (settled) {
        return;
      }
      settled = true;
      const state = useAppStore.getState();
      state.setGuideAudioPending(false);

      if (state.narrativeStep === 3 && state.guideAdvancePending) {
        state.setGuideAdvancePending(false);
        state.setNarrativeStep(4);
      }
    };

    guideAudio.addEventListener('ended', releaseGuideAudioLock);
    guideAudio.addEventListener('error', releaseGuideAudioLock);
    guideAudio.play().catch(err => {
      console.log('等待用户交互后才能播放音频', err);
      releaseGuideAudioLock();
    });

    return () => {
      guideAudio.removeEventListener('ended', releaseGuideAudioLock);
      guideAudio.removeEventListener('error', releaseGuideAudioLock);
    };
  }, [
    activeTab,
    currentRole,
    isMuted,
    narrativeStep,
    setGuideAdvancePending,
    setGuideAudioPending,
  ]);

  // 如果没有选择角色，重定向到角色选择页
  useEffect(() => {
    if (!currentRole) {
      navigate('/roles');
    }
  }, [currentRole, navigate]);

  useEffect(() => {
    if (appPhase !== 'complete') {
      return;
    }

    const timer = setTimeout(() => {
      audioRef.current?.pause();
      bgmRef.current?.pause();
      setActiveTab('monitor');
      navigate('/roles');
    }, 2000);

    return () => clearTimeout(timer);
  }, [appPhase, navigate, setActiveTab]);

  if (!currentRole) return null;

  // 模拟引脚输入
  const simulateSensor = (behavior: 'idle' | 'light_press' | 'normal_press' | 'hard_press', pressure: number) => {
    const { addBehaviorToHistory, appPhase, setAppPhase, activeTab } = useAppStore.getState();

    // 1. 设置当前压力和行为
    setCurrentBehavior(behavior);
    setCurrentPressure(pressure);

    // 2. 如果在监测页且为空闲，启动监测
    if (appPhase === 'idle' && activeTab === 'monitor') {
      setAppPhase('monitoring');
    }

    // 3. 记录历史，用于触发后续的逻辑（比如 5 次后评估，或者 guide 的步骤推进）
    if (appPhase !== 'evaluating' && behavior !== 'idle') {
      addBehaviorToHistory(behavior);
    }
    
    // Simulate release after 1.5s
    if (behavior !== 'idle') {
      setTimeout(() => {
        setCurrentBehavior('idle');
        setCurrentPressure(0);
      }, 1500);
    }
  };

  // 获取表情
  const getFaceExpression = () => {
    if (appPhase === 'evaluating') {
      return mindfulnessState === 'negative' ? '( ºAº )' : '( ˘▽˘ )';
    }
    if (activeTab === 'guide') {
      switch (Number(narrativeStep)) {
        case 1: return '(・_・)';
        case 2: return '( >_< )';
        case 3: return '( O_O )'; 
        case 4: return '( ˘▽˘ )';
        case 5: return '( ◡‿◡ )';
        default: return '( •_• )';
      }
    }
    if (currentBehavior === 'hard_press') return '( >o< )';
    if (currentBehavior === 'normal_press') return '( =_= )';
    if (currentBehavior === 'light_press') return '( ^_^ )';
    return '( •_• )';
  };

  // 极简叙事文案
  const getNarrativeText = () => {
    if (appPhase === 'dissolving') {
      return "压力随云飘散～";
    }
    if (appPhase === 'complete') {
      return "正念完成";
    }
    if (activeTab === 'guide') {
      switch (Number(narrativeStep)) {
        case 1: return "轻按一下";
        case 2: return "长按3秒";
        case 3: return `连按三下 ${narrativePressCount}/3`;
        case 4: return "慢慢松开";
        case 5: return "正念完成";
        default: return "准备中";
      }
    }
    if (appPhase === 'evaluating') {
      return mindfulnessState === 'negative' ? "有些烦躁" : "感到平静";
    }
    if (appPhase === 'monitoring') {
      return `感知中 ${behaviorHistory.length}/5`;
    }
    return "陪伴中";
  };
  
  const isNarrative = appPhase === 'narrative' || appPhase === 'dissolving' || appPhase === 'complete';
  const isDissolving = appPhase === 'dissolving';
  const isFinishing = appPhase === 'dissolving' || appPhase === 'complete';

  return (
    <div 
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden transition-colors duration-1000"
      style={{ backgroundColor: isNarrative ? '#F2F5F7' : '#F5F5F7' }}
    >
      <audio ref={audioRef} className="hidden" />
      <audio ref={bgmRef} src="/audio/bgm-soothing.mp3" loop className="hidden" />

      {/* 音乐控制开关 - 调整到圆屏可见区域（左上角偏内侧，稍微右移一点） */}
      {activeTab === 'guide' && !isFinishing && (
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="absolute top-10 left-12 z-[60] p-2 text-zinc-400 hover:text-zinc-600 transition-colors bg-white/50 rounded-full backdrop-blur shadow-sm"
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      )}

      {/* 顶部极简状态切换 */}
      <div className={`absolute top-8 flex gap-2 z-50 transition-opacity duration-500 ${isFinishing ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button
          onClick={() => setActiveTab('monitor')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all relative z-[60] ${
            activeTab === 'monitor' ? 'bg-white shadow-sm text-zinc-800' : 'text-zinc-400'
          }`}
        >
          监测
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all relative z-[60] ${
            activeTab === 'guide' ? 'bg-white shadow-sm text-zinc-800' : 'text-zinc-400'
          }`}
        >
          引导
        </button>
      </div>

      {/* 极简文案区 - 移动到底部与 Roles.tsx 角色名称对齐 */}
      <div className="absolute bottom-[50px] w-full flex flex-col items-center justify-end z-20">
        {appPhase === 'evaluating' && (
          <button
            onClick={() => setActiveTab('guide')}
            className="mb-3 px-4 py-1.5 bg-zinc-800 text-white text-xs rounded-full shadow relative z-30 animate-fade-in-up"
          >
            开始引导
          </button>
        )}
        <div key={String(narrativeStep) + appPhase} className="text-[14px] font-medium text-zinc-700 animate-fade-in-up leading-tight h-[21px] flex items-center">
          {getNarrativeText()}
        </div>
      </div>

      {/* 中心角色 (全屏呼吸光晕) */}
      <div className={`absolute top-1/2 left-1/2 z-10 flex h-full w-full -translate-x-1/2 -translate-y-1/2 transform items-center justify-center transition-opacity duration-500 pointer-events-none ${isDissolving ? 'opacity-0' : 'opacity-100'}`}>
        {/* 全屏呼吸光晕背景 */}
        <div
          className={`absolute w-[150%] h-[150%] rounded-full transition-all duration-1000 ${
            activeTab === 'guide' ? (
              Number(narrativeStep) === 2 ? 'scale-75 opacity-50' :
              Number(narrativeStep) === 4 ? 'scale-125 opacity-0' :
              'animate-breath-ring'
            ) : 'scale-100 opacity-0'
          }`}
          style={{ background: `radial-gradient(circle, ${currentRole.color}40 0%, transparent 70%)` }}
        />

        {/* Blob */}
        <div
          className={`relative w-36 h-36 rounded-[40%] flex items-center justify-center shadow-lg transition-all duration-500 z-10 ${
            appPhase === 'evaluating' ? (mindfulnessState === 'negative' ? 'animate-shake' : 'animate-bounce-slight') : 'animate-breath-blob'
          }`}
          style={{ 
            background: currentRole.gradient,
            borderRadius: '45% 55% 40% 60% / 55% 45% 60% 40%',
            border: currentRole.id === 'role_white' ? '1px solid rgba(0,0,0,0.05)' : 'none'
          }}
        >
          {/* 高光 */}
          <div className="absolute top-3 left-5 w-12 h-8 bg-white/40 rounded-full blur-[5px] transform -rotate-12 mix-blend-overlay" />
          {/* 表情 */}
          <div className={`text-2xl font-semibold opacity-80 ${currentRole.id === 'role_white' ? 'text-zinc-600' : 'text-white'}`}>
            {getFaceExpression()}
          </div>
        </div>
      </div>

      {/* 模拟硬件传感器面板 - 缩小并移至右侧 */}
      <AnimatePresence>
        {isDissolving && <CloudDissolveOverlay role={currentRole} />}
      </AnimatePresence>

      <div className={`absolute right-3 top-1/2 z-50 flex -translate-y-1/2 transform flex-col gap-2 transition-opacity duration-500 ${isFinishing ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button 
          onMouseDown={() => simulateSensor('hard_press', 0.8)}
          className="w-8 h-8 bg-zinc-200/60 text-zinc-600 text-[9px] rounded-full hover:bg-zinc-300 active:scale-95 transition-all shadow-sm flex items-center justify-center font-medium"
        >
          重按
        </button>
        <button 
          onMouseDown={() => simulateSensor('normal_press', 0.5)}
          className="w-8 h-8 bg-zinc-200/60 text-zinc-600 text-[9px] rounded-full hover:bg-zinc-300 active:scale-95 transition-all shadow-sm flex items-center justify-center font-medium"
        >
          正常
        </button>
        <button 
          onMouseDown={() => simulateSensor('light_press', 0.2)}
          className="w-8 h-8 bg-zinc-200/60 text-zinc-600 text-[9px] rounded-full hover:bg-zinc-300 active:scale-95 transition-all shadow-sm flex items-center justify-center font-medium"
        >
          轻按
        </button>
      </div>

    </div>
  );
};
