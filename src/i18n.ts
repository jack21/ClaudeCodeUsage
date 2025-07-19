import { SupportedLanguage } from './types';

export interface Translations {
  statusBar: {
    loading: string;
    noData: string;
    notRunning: string;
    error: string;
    currentSession: string;
  };
  popup: {
    title: string;
    currentSession: string;
    today: string;
    thisMonth: string;
    allTime: string;
    refresh: string;
    settings: string;
    totalTokens: string;
    inputTokens: string;
    outputTokens: string;
    cacheCreation: string;
    cacheRead: string;
    cost: string;
    messages: string;
    modelBreakdown: string;
    dailyBreakdown: string;
    date: string;
    yesterday: string;
    dataDirectory: string;
    noDataMessage: string;
    errorMessage: string;
  };
  settings: {
    title: string;
    refreshInterval: string;
    dataDirectory: string;
    language: string;
    decimalPlaces: string;
  };
}

const translations: Record<SupportedLanguage, Translations> = {
  en: {
    statusBar: {
      loading: 'Loading...',
      noData: 'No Claude Code Data',
      notRunning: 'Claude Code Not Running',
      error: 'Error',
      currentSession: 'Session',
    },
    popup: {
      title: 'Claude Code Usage',
      currentSession: 'Current Session',
      today: 'Today',
      thisMonth: 'This Month',
      allTime: 'All Time',
      refresh: 'Refresh',
      settings: 'Settings',
      totalTokens: 'Total Tokens',
      inputTokens: 'Input Tokens',
      outputTokens: 'Output Tokens',
      cacheCreation: 'Cache Creation',
      cacheRead: 'Cache Read',
      cost: 'Cost',
      messages: 'Messages',
      modelBreakdown: 'Model Usage',
      dailyBreakdown: 'Daily Usage',
      date: 'Date',
      yesterday: 'Yesterday',
      dataDirectory: 'Data Directory',
      noDataMessage: 'No usage data found. Make sure Claude Code is running and configured correctly.',
      errorMessage: 'Error loading usage data. Please check your configuration.',
    },
    settings: {
      title: 'Claude Code Usage Settings',
      refreshInterval: 'Refresh Interval (seconds)',
      dataDirectory: 'Data Directory Path',
      language: 'Language',
      decimalPlaces: 'Decimal Places',
    },
  },
  'zh-TW': {
    statusBar: {
      loading: '載入中...',
      noData: '無 Claude Code 資料',
      notRunning: 'Claude Code 未執行',
      error: '錯誤',
      currentSession: '當前會話',
    },
    popup: {
      title: 'Claude Code 使用量',
      currentSession: '當前會話',
      today: '今日',
      thisMonth: '本月',
      allTime: '所有',
      refresh: '重新整理',
      settings: '設定',
      totalTokens: '總 Token 數',
      inputTokens: '輸入 Token',
      outputTokens: '輸出 Token',
      cacheCreation: '快取建立',
      cacheRead: '快取讀取',
      cost: '成本',
      messages: '訊息數',
      modelBreakdown: '模型使用量',
      dailyBreakdown: '每日使用量',
      date: '日期',
      yesterday: '昨日',
      dataDirectory: '資料目錄',
      noDataMessage: '找不到使用資料。請確認 Claude Code 正在執行且設定正確。',
      errorMessage: '載入使用資料時發生錯誤。請檢查您的設定。',
    },
    settings: {
      title: 'Claude Code 使用量設定',
      refreshInterval: '重新整理間隔（秒）',
      dataDirectory: '資料目錄路徑',
      language: '語言',
      decimalPlaces: '小數位數',
    },
  },
  'zh-CN': {
    statusBar: {
      loading: '加载中...',
      noData: '无 Claude Code 数据',
      notRunning: 'Claude Code 未运行',
      error: '错误',
      currentSession: '当前会话',
    },
    popup: {
      title: 'Claude Code 使用量',
      currentSession: '当前会话',
      today: '今日',
      thisMonth: '本月',
      allTime: '所有',
      refresh: '刷新',
      settings: '设置',
      totalTokens: '总 Token 数',
      inputTokens: '输入 Token',
      outputTokens: '输出 Token',
      cacheCreation: '缓存创建',
      cacheRead: '缓存读取',
      cost: '成本',
      messages: '消息数',
      modelBreakdown: '模型使用量',
      dailyBreakdown: '每日使用量',
      date: '日期',
      yesterday: '昨日',
      dataDirectory: '数据目录',
      noDataMessage: '找不到使用数据。请确认 Claude Code 正在运行且配置正确。',
      errorMessage: '加载使用数据时发生错误。请检查您的配置。',
    },
    settings: {
      title: 'Claude Code 使用量设置',
      refreshInterval: '刷新间隔（秒）',
      dataDirectory: '数据目录路径',
      language: '语言',
      decimalPlaces: '小数位数',
    },
  },
  ja: {
    statusBar: {
      loading: '読み込み中...',
      noData: 'Claude Code データなし',
      notRunning: 'Claude Code 未実行',
      error: 'エラー',
      currentSession: '現在のセッション',
    },
    popup: {
      title: 'Claude Code 使用量',
      currentSession: '現在のセッション',
      today: '今日',
      thisMonth: '今月',
      allTime: 'すべて',
      refresh: '更新',
      settings: '設定',
      totalTokens: '総トークン数',
      inputTokens: '入力トークン',
      outputTokens: '出力トークン',
      cacheCreation: 'キャッシュ作成',
      cacheRead: 'キャッシュ読み取り',
      cost: 'コスト',
      messages: 'メッセージ数',
      modelBreakdown: 'モデル別使用量',
      dailyBreakdown: '日別使用量',
      date: '日付',
      yesterday: '昨日',
      dataDirectory: 'データディレクトリ',
      noDataMessage: '使用データが見つかりません。Claude Code が実行され、正しく設定されていることを確認してください。',
      errorMessage: '使用データの読み込み中にエラーが発生しました。設定を確認してください。',
    },
    settings: {
      title: 'Claude Code 使用量設定',
      refreshInterval: '更新間隔（秒）',
      dataDirectory: 'データディレクトリパス',
      language: '言語',
      decimalPlaces: '小数点以下桁数',
    },
  },
  ko: {
    statusBar: {
      loading: '로딩 중...',
      noData: 'Claude Code 데이터 없음',
      notRunning: 'Claude Code 실행되지 않음',
      error: '오류',
      currentSession: '현재 세션',
    },
    popup: {
      title: 'Claude Code 사용량',
      currentSession: '현재 세션',
      today: '오늘',
      thisMonth: '이번 달',
      allTime: '전체',
      refresh: '새로고침',
      settings: '설정',
      totalTokens: '총 토큰 수',
      inputTokens: '입력 토큰',
      outputTokens: '출력 토큰',
      cacheCreation: '캐시 생성',
      cacheRead: '캐시 읽기',
      cost: '비용',
      messages: '메시지 수',
      modelBreakdown: '모델별 사용량',
      dailyBreakdown: '일별 사용량',
      date: '날짜',
      yesterday: '어제',
      dataDirectory: '데이터 디렉토리',
      noDataMessage: '사용 데이터를 찾을 수 없습니다. Claude Code가 실행 중이고 올바르게 구성되었는지 확인하세요.',
      errorMessage: '사용 데이터를 로드하는 중 오류가 발생했습니다. 구성을 확인하세요.',
    },
    settings: {
      title: 'Claude Code 사용량 설정',
      refreshInterval: '새로고침 간격 (초)',
      dataDirectory: '데이터 디렉토리 경로',
      language: '언어',
      decimalPlaces: '소수점 자릿수',
    },
  },
};

export class I18n {
  private static currentLanguage: SupportedLanguage = 'en';

  static setLanguage(lang: SupportedLanguage | 'auto'): void {
    if (lang === 'auto') {
      this.currentLanguage = this.detectLanguage();
    } else {
      this.currentLanguage = lang;
    }
  }

  static getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  static get t(): Translations {
    return translations[this.currentLanguage];
  }

  private static detectLanguage(): SupportedLanguage {
    const locale = process.env.LANG || process.env.LANGUAGE || 'en';

    if (locale.includes('zh')) {
      if (locale.includes('TW') || locale.includes('HK') || locale.includes('MO')) {
        return 'zh-TW';
      }
      return 'zh-CN';
    }

    if (locale.includes('ja')) return 'ja';
    if (locale.includes('ko')) return 'ko';

    return 'en';
  }

  static formatCurrency(amount: number, decimalPlaces: number = 2): string {
    return `$${amount.toFixed(decimalPlaces)}`;
  }

  static formatNumber(num: number): string {
    return num.toLocaleString();
  }
}
