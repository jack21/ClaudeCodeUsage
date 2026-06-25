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
    workspaceToday: string;
    refresh: string;
    autoRefresh: string;
    settings: string;
    settingsTab: string;
    settingsIntro: string;
    settingsResetAll: string;
    settingsGroupGeneral: string;
    settingsGroupStatusBar: string;
    settingsGroupData: string;
    settingsGroupAdvice: string;
    totalTokens: string;
    inputTokens: string;
    outputTokens: string;
    cacheCreation: string;
    cacheRead: string;
    cost: string;
    messages: string;
    modelBreakdown: string;
    dailyBreakdown: string;
    monthlyBreakdown: string;
    hourlyBreakdown: string;
    sessions: string;
    sessionBreakdown: string;
    project: string;
    startTime: string;
    duration: string;
    hour: string;
    projects: string;
    projectBreakdown: string;
    fullPath: string;
    peakContext: string;
    tokenComposition: string;
    lastActive: string;
    pricing: string;
    refreshPricing: string;
    pricingUpdated: string;
    pricingUpdateFailed: string;
    sortHint: string;
    quota: string;
    quotaWindow: string;
    quotaLimit: string;
    quota5h: string;
    quotaWeekly: string;
    quotaHint: string;
    contextWindow: string;
    contextHint: string;
    contextLeft: string;
    contentAnalysis: string;
    estimatedNote: string;
    calibratedNote: string;
    calibratedTokens: string;
    thinkingTokensCalibrated: string;
    byTool: string;
    catUserPrompts: string;
    catAssistantText: string;
    catAssistantThinking: string;
    catToolCalls: string;
    catToolResults: string;
    estTokens: string;
    share: string;
    resets: string;
    cacheHitRate: string;
    last30days: string;
    branches: string;
    branchBreakdown: string;
    branch: string;
    workflows: string;
    workflowBreakdown: string;
    workflowName: string;
    model: string;
    agents: string;
    agent: string;
    workflowsThisMonth: string;
    workflowCostShare: string;
    workflowCacheHint: string;
    adhocBadge: string;
    workflowModeBadge: string;
    workflowModeHint: string;
    workflowNativeHint: string;
    orchestration: string;
    commonTaskPrefix: string;
    thinkingShare: string;
    effortHint: string;
    quotaWarnBanner: string;
    dismiss: string;
    attribution: string;
    attrDisclaimer: string;
    attrLargeContext: string;
    attrLargeContextShort: string;
    attrLargeContextHint: string;
    attrLongSessions: string;
    attrLongSessionsShort: string;
    attrLongSessionsHint: string;
    attrSubagentHeavy: string;
    attrSubagentHeavyShort: string;
    attrSubagentHeavyHint: string;
    attrWorkflows: string;
    attrWorkflowsShort: string;
    attrWorkflowsHint: string;
    attrSkillChar: string;
    attrSkillCharHint: string;
    attrPluginChar: string;
    attrPluginCharHint: string;
    attrSkills: string;
    attrSubagents: string;
    attrPlugins: string;
    attrModels: string;
    attrShare: string;
    count: string;
    scopeDay: string;
    scopeWeek: string;
    scopeMonth: string;
    attrTodayPointer: string;
    sessionTitle: string;
    getAdvice: string;
    adviceCardTitle: string;
    adviceCardDesc: string;
    optimizerTitle: string;
    optimizerDesc: string;
    optimizerConsent: string;
    optimizerEnableBtn: string;
    optimizerPlaceholder: string;
    optimizerRun: string;
    optimizerRunning: string;
    optimizerCopy: string;
    optimizerCopied: string;
    optimizerResolve: string;
    optimizerDistil: string;
    optimizerAesthetic: string;
    optimizerPromptHeading: string;
    optimizerSettingsHeading: string;
    adviceNeedsKey: string;
    adviceGenerating: string;
    adviceFailed: string;
    adviceScopeOverall: string;
    adviceScopePrompt: string;
    adviceDemoButton: string;
    adviceDemoNotice: string;
    costComposition: string;
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
      workspaceToday: 'This project',
      refresh: 'Refresh',
      autoRefresh: 'Auto refresh',
      settings: 'Settings',
      settingsTab: 'Settings',
      settingsIntro:
        'Settings live here now. Only language, data directory and API key remain in VS Code Settings (so they sync). Changes apply immediately.',
      settingsResetAll: 'Reset all to defaults',
      settingsGroupGeneral: 'General',
      settingsGroupStatusBar: 'Status bar',
      settingsGroupData: 'Data & refresh',
      settingsGroupAdvice: 'AI advice & Optimizer',
      totalTokens: 'Total Tokens',
      inputTokens: 'Input Tokens',
      outputTokens: 'Output Tokens',
      cacheCreation: 'Input Cache (Miss)',
      cacheRead: 'Input Cache (Hit)',
      cost: 'Cost',
      messages: 'Messages',
      modelBreakdown: 'Model Usage',
      dailyBreakdown: 'Daily Usage',
      monthlyBreakdown: 'Monthly Usage',
      hourlyBreakdown: 'Hourly Usage',
      sessions: 'Sessions',
      sessionBreakdown: 'Session Usage',
      project: 'Project',
      startTime: 'Start Time',
      duration: 'Duration',
      hour: 'Hour',
      projects: 'Projects',
      projectBreakdown: 'Project Usage',
      fullPath: 'Full Path',
      peakContext: 'Peak Context',
      tokenComposition: 'Token Composition',
      lastActive: 'Last Active',
      pricing: 'Pricing',
      refreshPricing: 'Refresh Token Pricing',
      pricingUpdated: 'Pricing updated',
      pricingUpdateFailed: 'Failed to update pricing',
      sortHint: 'Click a column header to sort',
      quota: 'Quota',
      quotaWindow: 'Window',
      quotaLimit: 'Limit',
      quota5h: '5-hour',
      quotaWeekly: 'Weekly',
      quotaHint: 'Real data from Anthropic /usage.',
      contextWindow: 'Context window',
      contextHint: 'New task? Use /clear to reset the context.',
      contextLeft: 'Context left',
      contentAnalysis: 'Content',
      estimatedNote: 'Estimated from text length — relative shares are reliable, absolute figures are approximate.',
      calibratedNote: 'Calibrated: per-category shares from text length, scaled to the exact billed token totals (output side / input + cache-write side). Toggle with analysis.calibrate.',
      calibratedTokens: 'Calibrated tokens',
      thinkingTokensCalibrated: 'real thinking tokens (calibrated)',
      byTool: 'Tool Results by Tool',
      catUserPrompts: 'Your prompts',
      catAssistantText: 'Assistant responses',
      catAssistantThinking: 'Assistant thinking',
      catToolCalls: 'Tool calls',
      catToolResults: 'Tool results',
      estTokens: 'Est. tokens',
      share: 'Share',
      resets: 'Resets',
      cacheHitRate: 'Cache Hit Rate',
      last30days: 'Last 30 days',
      branches: 'Branches',
      branchBreakdown: 'Branch Usage',
      branch: 'Branch',
      workflows: 'Workflows',
      workflowBreakdown: 'Workflow Usage',
      workflowName: 'Workflow',
      model: 'Model',
      agents: 'Agents',
      agent: 'Agent',
      workflowsThisMonth: 'Workflows this month',
      workflowCostShare: "share of this month's cost",
      workflowCacheHint:
        'Cache hit rate = cache reads ÷ all input-side tokens. Native Claude workflows reuse the prompt cache across agents (high rate); a provider without cross-agent caching shows ~0% — the same workflow costs disproportionately more there.',
      adhocBadge: 'subagents (ad-hoc)',
      workflowModeBadge: 'workflow',
      workflowModeHint:
        '"workflow" = a dynamic-workflow run dir on disk; "subagents (ad-hoc)" = a plain Task-tool fan-out. The effort level (ultracode/xhigh) is not recorded in the logs, so neither badge claims one.',
      workflowNativeHint:
        'Native-Claude ultracode often keeps its orchestration in the main session (no agent files), so it appears in Sessions / Usage tracking rather than as a row here. Runs that do write agent files show their Claude cost in the orchestration line. (Tracked for a future release.)',
      orchestration: 'main-session orchestration',
      commonTaskPrefix: 'Shared task text',
      thinkingShare: 'Thinking %',
      effortHint: 'High thinking share — consider /effort high instead of xhigh for tasks like this.',
      quotaWarnBanner:
        'Only {remaining}% of your 5-hour window is left. A workflow run can consume a large share of it — consider waiting for the reset: interrupted runs lose their prompt cache and re-run ~40% more expensive.',
      dismiss: 'Dismiss',
      attribution: 'Usage tracking',
      attrDisclaimer:
        'Approximate, based on local sessions on this machine — does not include other devices or claude.ai. These are independent characteristics of your usage, not a breakdown.',
      attrLargeContext: '{pct}% of your usage was at >150k context',
      attrLargeContextShort: '>150k context',
      attrLargeContextHint:
        'Longer sessions are more expensive even when cached. /compact mid-task, /clear when switching to new tasks.',
      attrLongSessions: '{pct}% of your usage came from sessions active 8+ hours',
      attrLongSessionsShort: '8h+ sessions',
      attrLongSessionsHint:
        'These are often background/loop sessions. Continuous usage can add up quickly, so make sure it is intentional.',
      attrSubagentHeavy: '{pct}% of your usage came from subagent-heavy sessions',
      attrSubagentHeavyShort: 'Subagent-heavy sessions',
      attrSubagentHeavyHint:
        'Each subagent runs its own requests. Be deliberate about spawning them — and consider a cheaper model for simpler subagents.',
      attrWorkflows: '{pct}% of your usage came from workflow runs',
      attrWorkflowsShort: 'Workflow runs',
      attrWorkflowsHint: 'See the Workflows tab for per-run details and cache hit rates.',
      attrSkillChar: '{pct}% of your usage came from {name}',
      attrSkillCharHint: 'Heavy skills can be scoped down or run with a cheaper model via skill frontmatter.',
      attrPluginChar: '{pct}% of your usage came from plugin "{name}"',
      attrPluginCharHint:
        'Review what this plugin contributes — its agents, skills and MCP tools all count toward your limit.',
      attrSkills: 'Skills',
      attrSubagents: 'Subagents',
      attrPlugins: 'Plugins',
      attrModels: 'Models',
      attrShare: '% of usage',
      count: 'Count',
      scopeDay: 'Day',
      scopeWeek: 'Week',
      scopeMonth: 'Month',
      attrTodayPointer: 'Details: Content tab',
      sessionTitle: 'Session',
      getAdvice: 'Get AI Advice',
      adviceCardTitle: 'AI advice',
      adviceCardDesc:
        'Send your usage digest + a sample of your own prompts to your model and get concrete tips on writing clearer instructions and cutting waste.',
      optimizerTitle: 'Usage optimizer',
      optimizerDesc:
        'Paste a rough request; get back a tightened, ready-to-paste prompt plus a suggested effort / thinking / model. Off by default; only your pasted text is sent.',
      optimizerConsent:
        'The Usage Optimizer sends the text you paste to your configured model (advice.backend). Nothing is sent to Claude Code and nothing is typed into a terminal. Continue?',
      optimizerEnableBtn: 'Enable in settings',
      optimizerPlaceholder: 'Paste a rough prompt to optimise…',
      optimizerRun: 'Optimise',
      optimizerRunning: 'Optimising…',
      optimizerCopy: 'Copy prompt',
      optimizerCopied: 'Copied',
      optimizerResolve: 'Flag vague references',
      optimizerDistil: 'Distil long pasted material',
      optimizerAesthetic: 'Offer style directions',
      optimizerPromptHeading: 'Optimised prompt',
      optimizerSettingsHeading: 'Recommended run settings',
      adviceNeedsKey: 'Set an API key in Settings to use AI advice.',
      adviceGenerating: 'Generating usage advice…',
      adviceFailed: 'Failed to get advice',
      adviceScopeOverall: 'Overall (all projects)',
      adviceScopePrompt: 'Choose what the advice should focus on',
      adviceDemoButton: 'Preview demo',
      adviceDemoNotice:
        '# DEMO — AI Usage Advice preview\n\n' +
        '> **This file is a static demo, not real advice.**\n' +
        '> The text below was hand-written to show what kind of output the\n' +
        '> feature produces. It is **not** based on your actual Claude Code\n' +
        '> usage data — nothing was sent to any API to generate this.\n\n' +
        '### To get real, personalised advice based on YOUR usage:\n\n' +
        '1. Open Settings (`Ctrl+,` / `Cmd+,`)\n' +
        '2. Search for **`claudeCodeUsage.advice.apiKey`**\n' +
        '3. Paste an OpenAI-compatible API key — DeepSeek works out of the box\n' +
        '   ([deepseek.com](https://platform.deepseek.com))\n' +
        '4. Re-run **`Claude Code Usage: Get AI Usage Advice`**',
      costComposition: 'Cost Composition',
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
  "de-DE": {
    statusBar: {
      loading: "Lädt...",
      noData: "Keine Claude Code Daten",
      notRunning: "Claude Code nicht erreichbar",
      error: "Error",
      currentSession: "Session",
    },
    popup: {
      title: "Claude Code Nutzung",
      currentSession: "Current Session",
      today: "Heute",
      thisMonth: "Diesen Monat",
      allTime: "Seit Aufzeichnungsbeginn",
      workspaceToday: "Dieses Projekt",
      refresh: "Aktualisieren",
      autoRefresh: "Auto-Aktualisierung",
      settings: "Einstellungen",
      settingsTab: "Einstellungen",
      settingsIntro:
        "Die Einstellungen sind jetzt hier. Nur Sprache, Datenverzeichnis und API-Schlüssel bleiben in den VS-Code-Einstellungen (damit sie synchronisiert werden). Änderungen wirken sofort.",
      settingsResetAll: "Alle zurücksetzen",
      settingsGroupGeneral: "Allgemein",
      settingsGroupStatusBar: "Statusleiste",
      settingsGroupData: "Daten & Aktualisierung",
      settingsGroupAdvice: "KI-Beratung & Optimizer",
      totalTokens: "Gesamte Token",
      inputTokens: "Eingabe Token",
      outputTokens: "Ausgabe Token",
      cacheCreation: "Eingabe-Cache (Miss)",
      cacheRead: "Eingabe-Cache (Hit)",
      cost: "Kosten",
      messages: "Nachrichten",
      modelBreakdown: "Nutzung nach Modell",
      dailyBreakdown: "Tages-Nutzungsübersicht",
      monthlyBreakdown: "Monats-Nutzungsübersicht",
      hourlyBreakdown: "Stunden-Nutzungsübersicht",
      sessions: "Sitzungen",
      sessionBreakdown: "Nutzung nach Sitzung",
      project: "Projekt",
      startTime: "Startzeit",
      duration: "Dauer",
      hour: "Stunde",
      projects: "Projekte",
      projectBreakdown: "Nutzung nach Projekt",
      fullPath: "Vollständiger Pfad",
      peakContext: "Größter Kontext",
      tokenComposition: "Token-Zusammensetzung",
      lastActive: "Zuletzt aktiv",
      pricing: "Preise",
      refreshPricing: "Token-Preise aktualisieren",
      pricingUpdated: "Preise aktualisiert",
      pricingUpdateFailed: "Preisaktualisierung fehlgeschlagen",
      sortHint: "Zum Sortieren auf eine Spaltenüberschrift klicken",
      quota: "Kontingent",
      quotaWindow: "Zeitfenster",
      quotaLimit: "Limit",
      quota5h: "5 Stunden",
      quotaWeekly: "Woche",
      quotaHint: "Echte Daten von Anthropic /usage.",
      contextWindow: "Kontextfenster",
      contextHint: "Neue Aufgabe? Mit /clear den Kontext zurücksetzen.",
      contextLeft: "Kontext frei",
      contentAnalysis: "Inhalt",
      estimatedNote: "Aus Textlänge geschätzt — relative Anteile sind verlässlich, absolute Werte ungefähr.",
      calibratedNote: "Kalibriert: Anteile je Kategorie aus der Textlänge, skaliert auf die exakten abgerechneten Token-Summen (Ausgabeseite / Eingabe + Cache-Schreiben). Umschalten mit analysis.calibrate.",
      calibratedTokens: "Kalibrierte Tokens",
      thinkingTokensCalibrated: "echte Denk-Tokens (kalibriert)",
      byTool: "Tool-Ergebnisse nach Tool",
      catUserPrompts: "Deine Eingaben",
      catAssistantText: "Assistent-Antworten",
      catAssistantThinking: "Assistent-Denken",
      catToolCalls: "Tool-Aufrufe",
      catToolResults: "Tool-Ergebnisse",
      estTokens: "Gesch. Token",
      share: "Anteil",
      resets: "Reset",
      cacheHitRate: "Cache-Trefferrate",
      last30days: "Letzte 30 Tage",
      branches: "Branches",
      branchBreakdown: "Nutzung nach Branch",
      branch: "Branch",
      workflows: "Workflows",
      workflowBreakdown: "Nutzung nach Workflow",
      workflowName: "Workflow",
      model: "Modell",
      agents: "Agenten",
      agent: "Agent",
      workflowsThisMonth: "Workflows diesen Monat",
      workflowCostShare: "Anteil an den Monatskosten",
      workflowCacheHint:
        "Cache-Trefferrate = Cache-Lesevorgänge ÷ alle eingabeseitigen Tokens. Native Claude-Workflows nutzen den Prompt-Cache agentenübergreifend (hohe Rate); ein Anbieter ohne agentenübergreifenden Cache zeigt ~0 % — derselbe Workflow kostet dort unverhältnismäßig mehr.",
      adhocBadge: "Subagenten (ad-hoc)",
      workflowModeBadge: "Workflow",
      workflowModeHint:
        '"Workflow" = ein Dynamic-Workflow-Laufverzeichnis auf der Platte; "Subagenten (ad-hoc)" = ein einfacher Task-Tool-Fan-out. Das Effort-Level (ultracode/xhigh) wird nicht protokolliert, daher behauptet kein Badge eines.',
      workflowNativeHint:
        'Native-Claude-Ultracode behält die Orchestrierung oft in der Hauptsitzung (keine Agent-Dateien) und erscheint daher in Sitzungen / Nutzungs-Tracking statt als Zeile hier. Läufe, die Agent-Dateien schreiben, zeigen ihre Claude-Kosten in der Orchestrierungszeile. (Für ein künftiges Release vorgemerkt.)',
      orchestration: "Orchestrierung der Hauptsitzung",
      commonTaskPrefix: "Gemeinsamer Aufgabentext",
      thinkingShare: "Denkanteil",
      effortHint: "Hoher Denkanteil — für solche Aufgaben /effort high statt xhigh erwägen.",
      quotaWarnBanner:
        "Nur noch {remaining}% des 5-Stunden-Fensters übrig. Ein Workflow-Lauf kann einen großen Teil davon verbrauchen — besser auf den Reset warten: unterbrochene Läufe verlieren ihren Prompt-Cache und kosten beim Neustart ~40% mehr.",
      dismiss: "Ausblenden",
      attribution: "Nutzungs-Tracking",
      attrDisclaimer:
        "Ungefähr, basierend auf lokalen Sitzungen dieses Rechners — andere Geräte oder claude.ai sind nicht enthalten. Unabhängige Merkmale der Nutzung, keine Aufschlüsselung.",
      attrLargeContext: "{pct}% der Nutzung lag bei >150k Kontext",
      attrLargeContextShort: ">150k Kontext",
      attrLargeContextHint:
        "Längere Sitzungen sind auch mit Cache teurer. /compact während der Aufgabe, /clear beim Aufgabenwechsel.",
      attrLongSessions: "{pct}% der Nutzung stammte aus Sitzungen mit 8+ aktiven Stunden",
      attrLongSessionsShort: "8h+ Sitzungen",
      attrLongSessionsHint:
        "Oft Hintergrund-/Loop-Sitzungen. Dauernutzung summiert sich schnell — sicherstellen, dass sie beabsichtigt ist.",
      attrSubagentHeavy: "{pct}% der Nutzung stammte aus Subagent-lastigen Sitzungen",
      attrSubagentHeavyShort: "Subagent-lastige Sitzungen",
      attrSubagentHeavyHint:
        "Jeder Subagent stellt eigene Anfragen. Bewusst einsetzen — für einfache Subagenten ein günstigeres Modell erwägen.",
      attrWorkflows: "{pct}% der Nutzung stammte aus Workflow-Läufen",
      attrWorkflowsShort: "Workflow-Läufe",
      attrWorkflowsHint: "Details und Cache-Trefferraten pro Lauf im Workflows-Tab.",
      attrSkillChar: "{pct}% der Nutzung stammte von {name}",
      attrSkillCharHint: "Schwere Skills lassen sich eingrenzen oder per Skill-Frontmatter mit günstigerem Modell betreiben.",
      attrPluginChar: "{pct}% der Nutzung stammte vom Plugin \"{name}\"",
      attrPluginCharHint:
        "Prüfen, was dieses Plugin beiträgt — seine Agenten, Skills und MCP-Tools zählen alle zum Limit.",
      attrSkills: "Skills",
      attrSubagents: "Subagenten",
      attrPlugins: "Plugins",
      attrModels: "Modelle",
      attrShare: "% der Nutzung",
      count: "Anzahl",
      scopeDay: "Tag",
      scopeWeek: "Woche",
      scopeMonth: "Monat",
      attrTodayPointer: "Details: Inhalt-Tab",
      sessionTitle: "Sitzung",
      getAdvice: "KI-Rat holen",
      adviceCardTitle: "KI-Rat",
      adviceCardDesc:
        "Sende deine Nutzungsübersicht + eine Auswahl deiner eigenen Prompts an dein Modell und erhalte konkrete Tipps für klarere Anweisungen und weniger Verschwendung.",
      optimizerTitle: "Nutzungs-Optimierer",
      optimizerDesc:
        "Füge eine grobe Anfrage ein; erhalte einen verdichteten, einfügefertigen Prompt plus empfohlenes Effort / Thinking / Modell. Standardmäßig aus; nur dein eingefügter Text wird gesendet.",
      optimizerConsent:
        "Der Nutzungs-Optimierer sendet den eingefügten Text an dein konfiguriertes Modell (advice.backend). Nichts geht an Claude Code, nichts wird ins Terminal getippt. Fortfahren?",
      optimizerEnableBtn: "In Einstellungen aktivieren",
      optimizerPlaceholder: "Groben Prompt zum Optimieren einfügen…",
      optimizerRun: "Optimieren",
      optimizerRunning: "Optimiere…",
      optimizerCopy: "Prompt kopieren",
      optimizerCopied: "Kopiert",
      optimizerResolve: "Vage Referenzen markieren",
      optimizerDistil: "Lange Inhalte verdichten",
      optimizerAesthetic: "Stilrichtungen anbieten",
      optimizerPromptHeading: "Optimierter Prompt",
      optimizerSettingsHeading: "Empfohlene Lauf-Einstellungen",
      adviceNeedsKey: "API-Schlüssel in den Einstellungen festlegen, um KI-Rat zu nutzen.",
      adviceGenerating: "Nutzungsrat wird erstellt…",
      adviceFailed: "Rat konnte nicht abgerufen werden",
      adviceScopeOverall: "Gesamt (alle Projekte)",
      adviceScopePrompt: "Worauf soll sich der Rat konzentrieren?",
      adviceDemoButton: "Demo ansehen",
      adviceDemoNotice:
        '# DEMO — KI-Nutzungsrat-Vorschau\n\n' +
        '> **Diese Datei ist eine statische Demo, kein echter Rat.**\n' +
        '> Der untenstehende Text wurde handgeschrieben, um zu zeigen, welche\n' +
        '> Art von Output die Funktion erzeugt. Er basiert **nicht** auf\n' +
        '> Ihren tatsächlichen Nutzungsdaten — es wurde nichts an eine API\n' +
        '> gesendet, um diesen Text zu generieren.\n\n' +
        '### Für echten, personalisierten Rat basierend auf IHRER Nutzung:\n\n' +
        '1. Einstellungen öffnen (`Ctrl+,` / `Cmd+,`)\n' +
        '2. Nach **`claudeCodeUsage.advice.apiKey`** suchen\n' +
        '3. Einen OpenAI-kompatiblen API-Key einfügen — DeepSeek funktioniert\n' +
        '   sofort ([deepseek.com](https://platform.deepseek.com))\n' +
        '4. **`Claude Code Usage: Get AI Usage Advice`** erneut ausführen',
      costComposition: "Kostenzusammensetzung",
      date: "Datum",
      yesterday: "Gestern",
      dataDirectory: "Daten Pfad",
      noDataMessage:
        "Keine Daten gefunden. Stell sicher, dass Claude Code läuft und entsprechend konfiguriert ist.",
      errorMessage:
        "Fehler beim laden der Nutzungsdaten. Bitte prüfe deine Konfiguration.",
    },
    settings: {
      title: "Claude Code Nutzungseinstellungen",
      refreshInterval: "Aktualisierungsinterval (in Sekunden)",
      dataDirectory: "Datenordner Pfad",
      language: "Sprache",
      decimalPlaces: "Dezimalstellen",
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
      workspaceToday: '本專案',
      refresh: '重新整理',
      autoRefresh: '自動刷新',
      settings: '設定',
      settingsTab: '設定',
      settingsIntro:
        '設定現在都在這裡。只有語言、資料目錄與 API 金鑰仍留在 VS Code 設定中(以便同步)。變更會立即生效。',
      settingsResetAll: '全部還原為預設',
      settingsGroupGeneral: '一般',
      settingsGroupStatusBar: '狀態列',
      settingsGroupData: '資料與重新整理',
      settingsGroupAdvice: 'AI 建議與最佳化工具',
      totalTokens: '總 Token 數',
      inputTokens: '輸入 Token',
      outputTokens: '輸出 Token',
      cacheCreation: '輸入快取（未命中）',
      cacheRead: '輸入快取（命中）',
      cost: '成本',
      messages: '訊息數',
      modelBreakdown: '模型使用量',
      dailyBreakdown: '每日使用量',
      monthlyBreakdown: '每月使用量',
      hourlyBreakdown: '每小時使用量',
      sessions: '會話',
      sessionBreakdown: '各會話使用量',
      project: '專案',
      startTime: '開始時間',
      duration: '時長',
      hour: '小時',
      projects: '專案',
      projectBreakdown: '各專案使用量',
      fullPath: '完整路徑',
      peakContext: '峰值上下文',
      tokenComposition: 'Token 組成',
      lastActive: '最近活動',
      pricing: '計費標準',
      refreshPricing: '更新 Token 單價',
      pricingUpdated: '價格已更新',
      pricingUpdateFailed: '價格更新失敗',
      sortHint: '點擊欄位標題可排序',
      quota: '用量額度',
      quotaWindow: '時間視窗',
      quotaLimit: '上限',
      quota5h: '5 小時',
      quotaWeekly: '每週',
      quotaHint: '來自 Anthropic /usage 的真實資料。',
      contextWindow: '上下文視窗',
      contextHint: '切換任務時用 /clear 重置上下文。',
      contextLeft: '上下文餘量',
      contentAnalysis: '內容分析',
      estimatedNote: '由文字長度估算 —— 相對佔比可靠,絕對數值為近似值。',
      calibratedNote: '已校準：各類別佔比由文字長度估算,再縮放到精確的帳單 token 總量（輸出側 / 輸入＋快取寫入側）。用 analysis.calibrate 切換。',
      calibratedTokens: '已校準 token',
      thinkingTokensCalibrated: '真實思考 token（已校準）',
      byTool: '各工具結果用量',
      catUserPrompts: '你的提問',
      catAssistantText: '助手回覆',
      catAssistantThinking: '助手思考',
      catToolCalls: '工具呼叫',
      catToolResults: '工具結果',
      estTokens: '估算 Token',
      share: '佔比',
      resets: '重置',
      cacheHitRate: '快取命中率',
      last30days: '近 30 天',
      branches: '分支',
      branchBreakdown: '各分支使用量',
      branch: '分支',
      workflows: '工作流',
      workflowBreakdown: '各工作流使用量',
      workflowName: '工作流',
      model: '模型',
      agents: '代理數',
      agent: '代理',
      workflowsThisMonth: '本月工作流',
      workflowCostShare: '佔本月成本',
      workflowCacheHint:
        '快取命中率 = 快取讀取 ÷ 全部輸入側 token。原生 Claude 工作流可在代理間重用提示快取（命中率高）；不支援跨代理快取的供應商約為 0%——同樣的工作流在那裡的成本會高出許多。',
      adhocBadge: '子代理（臨時）',
      workflowModeBadge: '工作流',
      workflowModeHint:
        '「工作流」= 磁碟上有動態工作流運行目錄；「子代理（臨時）」= 普通 Task 工具扇出。effort 等級（ultracode/xhigh）不會記入日誌，所以兩種徽標都不對其作斷言。',
      workflowNativeHint:
        '原生 Claude 的 ultracode 常把編排留在主會話（不寫 agent 檔），因此會出現在「會話 / 用量追蹤」而非此處的列。會寫 agent 檔的運行，其 Claude 成本顯示在編排行。（已記入後續版本待辦。）',
      orchestration: '主會話編排',
      commonTaskPrefix: '共同任務文字',
      thinkingShare: '思考佔比',
      effortHint: '思考佔比偏高——此類任務可考慮用 /effort high 取代 xhigh。',
      quotaWarnBanner:
        '5 小時窗口僅剩 {remaining}%。一次工作流運行可能消耗其中很大一部分——建議等待重置後再啟動：中斷的運行會遺失提示快取，重跑成本約高 40%。',
      dismiss: '關閉',
      attribution: '用量追蹤',
      attrDisclaimer:
        '近似值，基於本機的本地會話——不含其他裝置或 claude.ai。以下為用量的獨立特徵，並非分解。',
      attrLargeContext: '{pct}% 的用量處於 >150k 上下文',
      attrLargeContextShort: '>150k 上下文',
      attrLargeContextHint: '長上下文即使有快取也更貴。任務中用 /compact，切換任務時用 /clear。',
      attrLongSessions: '{pct}% 的用量來自活躍 8 小時以上的會話',
      attrLongSessionsShort: '8 小時以上會話',
      attrLongSessionsHint: '通常是背景／循環會話。持續用量累積很快，請確認是有意為之。',
      attrSubagentHeavy: '{pct}% 的用量來自子代理密集的會話',
      attrSubagentHeavyShort: '子代理密集會話',
      attrSubagentHeavyHint: '每個子代理都有自己的請求。請審慎派生——簡單子代理可考慮更便宜的模型。',
      attrWorkflows: '{pct}% 的用量來自工作流運行',
      attrWorkflowsShort: '工作流運行',
      attrWorkflowsHint: '各運行的明細與快取命中率見「工作流」頁籤。',
      attrSkillChar: '{pct}% 的用量來自 {name}',
      attrSkillCharHint: '重型 skill 可縮小範圍，或透過 skill frontmatter 指定更便宜的模型。',
      attrPluginChar: '{pct}% 的用量來自插件「{name}」',
      attrPluginCharHint: '檢視該插件的貢獻——其代理、skill 與 MCP 工具都計入額度。',
      attrSkills: 'Skills',
      attrSubagents: '子代理',
      attrPlugins: '插件',
      attrModels: '模型',
      attrShare: '用量佔比',
      count: '次數',
      scopeDay: '日',
      scopeWeek: '週',
      scopeMonth: '月',
      attrTodayPointer: '詳情見「內容分析」頁籤',
      sessionTitle: '會話',
      getAdvice: '取得 AI 建議',
      adviceCardTitle: 'AI 建議',
      adviceCardDesc:
        '將你的用量摘要 + 你自己的 prompt 樣本送給模型，取得寫出更清楚指令、減少浪費的具體建議。',
      optimizerTitle: '用量優化器',
      optimizerDesc:
        '貼上粗略的需求，得到精煉、可直接貼上的 prompt，以及建議的 effort / thinking / 模型。預設關閉；只會送出你貼上的文字。',
      optimizerConsent:
        '用量優化器會把你貼上的文字送給你配置的模型（advice.backend）。不會送給 Claude Code，也不會注入終端。要繼續嗎？',
      optimizerEnableBtn: '在設定中啟用',
      optimizerPlaceholder: '貼上要優化的粗略 prompt…',
      optimizerRun: '優化',
      optimizerRunning: '優化中…',
      optimizerCopy: '複製 prompt',
      optimizerCopied: '已複製',
      optimizerResolve: '標記模糊引用',
      optimizerDistil: '提煉長貼上材料',
      optimizerAesthetic: '提供風格方向',
      optimizerPromptHeading: '優化後 prompt',
      optimizerSettingsHeading: '建議運行設定',
      adviceNeedsKey: '請先在設定中填入 API 金鑰以使用 AI 建議。',
      adviceGenerating: '正在產生使用建議…',
      adviceFailed: '取得建議失敗',
      adviceScopeOverall: '整體(所有專案)',
      adviceScopePrompt: '選擇建議要聚焦的範圍',
      adviceDemoButton: '查看示範',
      adviceDemoNotice:
        '# 示範 — AI 用量建議預覽\n\n' +
        '> **本檔案是靜態示範,不是真實建議。**\n' +
        '> 下面的內容是手寫的範例,用來展示此功能的輸出風格。\n' +
        '> 它**不是**基於你實際的 Claude Code 用量資料 ——\n' +
        '> 沒有任何資料被送往 API 來產生本內容。\n\n' +
        '### 要取得基於你實際用量的個人化建議:\n\n' +
        '1. 開啟設定(`Ctrl+,` / `Cmd+,`)\n' +
        '2. 搜尋 **`claudeCodeUsage.advice.apiKey`**\n' +
        '3. 貼入 OpenAI-相容 API key —— DeepSeek 開箱即用\n' +
        '   ([deepseek.com](https://platform.deepseek.com))\n' +
        '4. 重新執行 **`Claude Code Usage: Get AI Usage Advice`**',
      costComposition: '成本構成',
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
      workspaceToday: '本项目',
      refresh: '刷新',
      autoRefresh: '自动刷新',
      settings: '设置',
      settingsTab: '设置',
      settingsIntro:
        '设置现在都在这里。只有语言、数据目录和 API key 仍留在 VS Code 设置中(便于同步)。更改即时生效。',
      settingsResetAll: '全部恢复默认',
      settingsGroupGeneral: '常规',
      settingsGroupStatusBar: '状态栏',
      settingsGroupData: '数据与刷新',
      settingsGroupAdvice: 'AI 建议与优化器',
      totalTokens: '总 Token 数',
      inputTokens: '输入 Token',
      outputTokens: '输出 Token',
      cacheCreation: '输入缓存（未命中）',
      cacheRead: '输入缓存（命中）',
      cost: '成本',
      messages: '消息数',
      modelBreakdown: '模型使用量',
      dailyBreakdown: '每日使用量',
      monthlyBreakdown: '每月使用量',
      hourlyBreakdown: '每小时使用量',
      sessions: '会话',
      sessionBreakdown: '各会话使用量',
      project: '项目',
      startTime: '开始时间',
      duration: '时长',
      hour: '小时',
      projects: '项目',
      projectBreakdown: '各项目使用量',
      fullPath: '完整路径',
      peakContext: '峰值上下文',
      tokenComposition: 'Token 组成',
      lastActive: '最近活动',
      pricing: '计费标准',
      refreshPricing: '更新 Token 单价',
      pricingUpdated: '价格已更新',
      pricingUpdateFailed: '价格更新失败',
      sortHint: '点击列标题可排序',
      quota: '用量额度',
      quotaWindow: '时间窗口',
      quotaLimit: '上限',
      quota5h: '5 小时',
      quotaWeekly: '每周',
      quotaHint: '来自 Anthropic /usage 的真实数据。',
      contextWindow: '上下文窗口',
      contextHint: '切换任务时用 /clear 重置上下文。',
      contextLeft: '上下文余量',
      contentAnalysis: '内容分析',
      estimatedNote: '由文本长度估算 —— 相对占比可靠,绝对数值为近似值。',
      calibratedNote: '已校准：各类别占比由文本长度估算,再缩放到精确的账单 token 总量（输出侧 / 输入＋缓存写入侧）。用 analysis.calibrate 切换。',
      calibratedTokens: '已校准 token',
      thinkingTokensCalibrated: '真实思考 token（已校准）',
      byTool: '各工具结果用量',
      catUserPrompts: '你的提问',
      catAssistantText: '助手回复',
      catAssistantThinking: '助手思考',
      catToolCalls: '工具调用',
      catToolResults: '工具结果',
      estTokens: '估算 Token',
      share: '占比',
      resets: '重置',
      cacheHitRate: '缓存命中率',
      last30days: '近 30 天',
      branches: '分支',
      branchBreakdown: '各分支使用量',
      branch: '分支',
      workflows: '工作流',
      workflowBreakdown: '各工作流使用量',
      workflowName: '工作流',
      model: '模型',
      agents: '代理数',
      agent: '代理',
      workflowsThisMonth: '本月工作流',
      workflowCostShare: '占本月成本',
      workflowCacheHint:
        '缓存命中率 = 缓存读取 ÷ 全部输入侧 token。原生 Claude 工作流可在代理间复用提示缓存（命中率高）；不支持跨代理缓存的供应商约为 0%——同样的工作流在那里的成本会高出许多。',
      adhocBadge: '子代理（临时）',
      workflowModeBadge: '工作流',
      workflowModeHint:
        '「工作流」= 磁盘上有动态工作流运行目录；「子代理（临时）」= 普通 Task 工具扇出。effort 等级（ultracode/xhigh）不会记入日志，所以两种徽标都不对其作断言。',
      workflowNativeHint:
        '原生 Claude 的 ultracode 常把编排留在主会话（不写 agent 文件），因此会出现在「会话 / 用量追踪」而非此处的行。会写 agent 文件的运行，其 Claude 成本显示在编排行。（已记入后续版本待办。）',
      orchestration: '主会话编排',
      commonTaskPrefix: '共同任务文字',
      thinkingShare: '思考占比',
      effortHint: '思考占比偏高——此类任务可考虑用 /effort high 取代 xhigh。',
      quotaWarnBanner:
        '5 小时窗口仅剩 {remaining}%。一次工作流运行可能消耗其中很大一部分——建议等待重置后再启动：中断的运行会丢失提示缓存，重跑成本约高 40%。',
      dismiss: '关闭',
      attribution: '用量追踪',
      attrDisclaimer:
        '近似值，基于本机的本地会话——不含其他设备或 claude.ai。以下为用量的独立特征，并非分解。',
      attrLargeContext: '{pct}% 的用量处于 >150k 上下文',
      attrLargeContextShort: '>150k 上下文',
      attrLargeContextHint: '长上下文即使有缓存也更贵。任务中用 /compact，切换任务时用 /clear。',
      attrLongSessions: '{pct}% 的用量来自活跃 8 小时以上的会话',
      attrLongSessionsShort: '8 小时以上会话',
      attrLongSessionsHint: '通常是后台／循环会话。持续用量累积很快，请确认是有意为之。',
      attrSubagentHeavy: '{pct}% 的用量来自子代理密集的会话',
      attrSubagentHeavyShort: '子代理密集会话',
      attrSubagentHeavyHint: '每个子代理都有自己的请求。请审慎派生——简单子代理可考虑更便宜的模型。',
      attrWorkflows: '{pct}% 的用量来自工作流运行',
      attrWorkflowsShort: '工作流运行',
      attrWorkflowsHint: '各运行的明细与缓存命中率见「工作流」页签。',
      attrSkillChar: '{pct}% 的用量来自 {name}',
      attrSkillCharHint: '重型 skill 可缩小范围，或通过 skill frontmatter 指定更便宜的模型。',
      attrPluginChar: '{pct}% 的用量来自插件「{name}」',
      attrPluginCharHint: '检视该插件的贡献——其代理、skill 与 MCP 工具都计入额度。',
      attrSkills: 'Skills',
      attrSubagents: '子代理',
      attrPlugins: '插件',
      attrModels: '模型',
      attrShare: '用量占比',
      count: '次数',
      scopeDay: '日',
      scopeWeek: '周',
      scopeMonth: '月',
      attrTodayPointer: '详情见「内容分析」页签',
      sessionTitle: '会话',
      getAdvice: '获取 AI 建议',
      adviceCardTitle: 'AI 建议',
      adviceCardDesc:
        '将你的用量摘要 + 你自己的 prompt 样本送给模型，获得写出更清晰指令、减少浪费的具体建议。',
      optimizerTitle: '用量优化器',
      optimizerDesc:
        '粘贴粗略的需求，得到精炼、可直接粘贴的 prompt，以及建议的 effort / thinking / 模型。默认关闭；只会发送你粘贴的文字。',
      optimizerConsent:
        '用量优化器会把你粘贴的文字发送给你配置的模型（advice.backend）。不会发送给 Claude Code，也不会注入终端。要继续吗？',
      optimizerEnableBtn: '在设置中启用',
      optimizerPlaceholder: '粘贴要优化的粗略 prompt…',
      optimizerRun: '优化',
      optimizerRunning: '优化中…',
      optimizerCopy: '复制 prompt',
      optimizerCopied: '已复制',
      optimizerResolve: '标记模糊引用',
      optimizerDistil: '提炼长粘贴材料',
      optimizerAesthetic: '提供风格方向',
      optimizerPromptHeading: '优化后 prompt',
      optimizerSettingsHeading: '建议运行设置',
      adviceNeedsKey: '请先在设置中填入 API 密钥以使用 AI 建议。',
      adviceGenerating: '正在生成使用建议…',
      adviceFailed: '获取建议失败',
      adviceScopeOverall: '整体(所有项目)',
      adviceScopePrompt: '选择建议要聚焦的范围',
      adviceDemoButton: '查看示例',
      adviceDemoNotice:
        '# 示例 — AI 用量建议预览\n\n' +
        '> **本文件是静态示例,不是真实建议。**\n' +
        '> 下面的内容是手写的样例,用来展示此功能的输出风格。\n' +
        '> 它**不是**基于你实际的 Claude Code 用量数据 ——\n' +
        '> 没有任何数据被发往 API 来生成本内容。\n\n' +
        '### 要获得基于你实际用量的个性化建议:\n\n' +
        '1. 打开设置(`Ctrl+,` / `Cmd+,`)\n' +
        '2. 搜索 **`claudeCodeUsage.advice.apiKey`**\n' +
        '3. 填入 OpenAI-兼容 API key —— DeepSeek 开箱即用\n' +
        '   ([deepseek.com](https://platform.deepseek.com))\n' +
        '4. 重新运行 **`Claude Code Usage: Get AI Usage Advice`**',
      costComposition: '成本构成',
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
      workspaceToday: 'このプロジェクト',
      refresh: '更新',
      autoRefresh: '自動更新',
      settings: '設定',
      settingsTab: '設定',
      settingsIntro:
        '設定はここにまとまりました。言語・データディレクトリ・API キーのみ VS Code 設定に残ります(同期のため)。変更は即時反映されます。',
      settingsResetAll: 'すべて既定値に戻す',
      settingsGroupGeneral: '一般',
      settingsGroupStatusBar: 'ステータスバー',
      settingsGroupData: 'データと更新',
      settingsGroupAdvice: 'AI アドバイス & オプティマイザー',
      totalTokens: '総トークン数',
      inputTokens: '入力トークン',
      outputTokens: '出力トークン',
      cacheCreation: '入力キャッシュ（ミス）',
      cacheRead: '入力キャッシュ（ヒット）',
      cost: 'コスト',
      messages: 'メッセージ数',
      modelBreakdown: 'モデル別使用量',
      dailyBreakdown: '日別使用量',
      monthlyBreakdown: '月別使用量',
      hourlyBreakdown: '時間別使用量',
      sessions: 'セッション',
      sessionBreakdown: 'セッション別使用量',
      project: 'プロジェクト',
      startTime: '開始時刻',
      duration: '期間',
      hour: '時刻',
      projects: 'プロジェクト',
      projectBreakdown: 'プロジェクト別使用量',
      fullPath: 'フルパス',
      peakContext: '最大コンテキスト',
      tokenComposition: 'トークン構成',
      lastActive: '最終アクティブ',
      pricing: '料金',
      refreshPricing: 'Token 単価を更新',
      pricingUpdated: '価格を更新しました',
      pricingUpdateFailed: '価格の更新に失敗しました',
      sortHint: '列見出しをクリックで並べ替え',
      quota: '使用枠',
      quotaWindow: '期間',
      quotaLimit: '上限',
      quota5h: '5時間',
      quotaWeekly: '週間',
      quotaHint: 'Anthropic /usage からの実データ。',
      contextWindow: 'コンテキストウィンドウ',
      contextHint: 'タスク切替時は /clear でコンテキストをリセット。',
      contextLeft: 'コンテキスト残り',
      contentAnalysis: 'コンテンツ',
      estimatedNote: 'テキスト長からの推定値 — 相対割合は信頼でき、絶対値は概算です。',
      calibratedNote: 'キャリブレーション済み：カテゴリ別の割合はテキスト長から推定し、正確な請求トークン総量（出力側 / 入力＋キャッシュ書込側）にスケールしています。analysis.calibrate で切替。',
      calibratedTokens: 'キャリブレーション済みトークン',
      thinkingTokensCalibrated: '実際の思考トークン（キャリブレーション済み）',
      byTool: 'ツール別の結果使用量',
      catUserPrompts: 'あなたの入力',
      catAssistantText: 'アシスタント応答',
      catAssistantThinking: 'アシスタント思考',
      catToolCalls: 'ツール呼び出し',
      catToolResults: 'ツール結果',
      estTokens: '推定トークン',
      share: '割合',
      resets: 'リセット',
      cacheHitRate: 'キャッシュヒット率',
      last30days: '過去 30 日',
      branches: 'ブランチ',
      branchBreakdown: 'ブランチ別使用量',
      branch: 'ブランチ',
      workflows: 'ワークフロー',
      workflowBreakdown: 'ワークフロー別使用量',
      workflowName: 'ワークフロー',
      model: 'モデル',
      agents: 'エージェント数',
      agent: 'エージェント',
      workflowsThisMonth: '今月のワークフロー',
      workflowCostShare: '今月のコストに占める割合',
      workflowCacheHint:
        'キャッシュヒット率 = キャッシュ読取 ÷ 入力側トークン全体。ネイティブ Claude のワークフローはエージェント間でプロンプトキャッシュを再利用します（高い率）。エージェント間キャッシュのないプロバイダーでは約 0% となり、同じワークフローのコストが大幅に高くなります。',
      adhocBadge: 'サブエージェント（アドホック）',
      workflowModeBadge: 'ワークフロー',
      workflowModeHint:
        '「ワークフロー」= ディスク上に動的ワークフローの実行ディレクトリがある場合；「サブエージェント（アドホック）」= 単純な Task ツールのファンアウト。effort レベル（ultracode/xhigh）はログに記録されないため、どちらのバッジもそれを主張しません。',
      workflowNativeHint:
        'ネイティブ Claude の ultracode はオーケストレーションをメインセッションに保持する（エージェントファイルなし）ことが多く、ここではなく「セッション / 使用量トラッキング」に表示されます。エージェントファイルを書く実行は、その Claude コストをオーケストレーション行に表示します。（今後のリリースで対応予定。）',
      orchestration: 'メインセッションのオーケストレーション',
      commonTaskPrefix: '共通タスクテキスト',
      thinkingShare: '思考割合',
      effortHint: '思考割合が高め — このようなタスクでは xhigh ではなく /effort high の利用を検討してください。',
      quotaWarnBanner:
        '5 時間ウィンドウの残りは {remaining}% のみです。ワークフロー実行はその大部分を消費する可能性があります — リセットを待つことを検討してください。中断された実行はプロンプトキャッシュを失い、再実行は約 40% 高くなります。',
      dismiss: '閉じる',
      attribution: '使用量トラッキング',
      attrDisclaimer:
        'このマシンのローカルセッションに基づく概算 — 他のデバイスや claude.ai は含みません。これらは使用量の独立した特徴であり、内訳ではありません。',
      attrLargeContext: '使用量の {pct}% が >150k コンテキストでした',
      attrLargeContextShort: '>150k コンテキスト',
      attrLargeContextHint:
        '長いコンテキストはキャッシュがあっても高コストです。タスク中は /compact、タスク切替時は /clear を。',
      attrLongSessions: '使用量の {pct}% が 8 時間以上アクティブなセッションからでした',
      attrLongSessionsShort: '8時間以上のセッション',
      attrLongSessionsHint:
        '多くはバックグラウンド／ループセッションです。継続的な使用はすぐ積み上がるため、意図的か確認してください。',
      attrSubagentHeavy: '使用量の {pct}% がサブエージェント中心のセッションからでした',
      attrSubagentHeavyShort: 'サブエージェント中心セッション',
      attrSubagentHeavyHint:
        '各サブエージェントは独自のリクエストを実行します。生成は慎重に — 単純なものには安価なモデルの利用も検討を。',
      attrWorkflows: '使用量の {pct}% がワークフロー実行からでした',
      attrWorkflowsShort: 'ワークフロー実行',
      attrWorkflowsHint: '実行ごとの詳細とキャッシュヒット率はワークフロータブへ。',
      attrSkillChar: '使用量の {pct}% が {name} からでした',
      attrSkillCharHint: '重いスキルは範囲を絞るか、skill frontmatter で安価なモデルを指定できます。',
      attrPluginChar: '使用量の {pct}% がプラグイン「{name}」からでした',
      attrPluginCharHint:
        'このプラグインの寄与を確認してください — エージェント、スキル、MCP ツールはすべて制限にカウントされます。',
      attrSkills: 'スキル',
      attrSubagents: 'サブエージェント',
      attrPlugins: 'プラグイン',
      attrModels: 'モデル',
      attrShare: '使用量比率',
      count: '回数',
      scopeDay: '日',
      scopeWeek: '週',
      scopeMonth: '月',
      attrTodayPointer: '詳細はコンテンツタブへ',
      sessionTitle: 'セッション',
      getAdvice: 'AI アドバイスを取得',
      adviceCardTitle: 'AI アドバイス',
      adviceCardDesc:
        '使用量サマリー + あなた自身のプロンプトのサンプルをモデルに送り、より明確な指示と無駄削減の具体的なヒントを得ます。',
      optimizerTitle: '使用量オプティマイザー',
      optimizerDesc:
        '雑な依頼を貼り付けると、引き締まった貼り付け可能なプロンプトと、推奨 effort / thinking / モデルが返ります。既定でオフ。送信されるのは貼り付けたテキストのみ。',
      optimizerConsent:
        '使用量オプティマイザーは貼り付けたテキストを設定したモデル（advice.backend）に送信します。Claude Code には送られず、ターミナルにも入力されません。続行しますか？',
      optimizerEnableBtn: '設定で有効化',
      optimizerPlaceholder: '最適化する雑なプロンプトを貼り付け…',
      optimizerRun: '最適化',
      optimizerRunning: '最適化中…',
      optimizerCopy: 'プロンプトをコピー',
      optimizerCopied: 'コピー済み',
      optimizerResolve: '曖昧な参照を指摘',
      optimizerDistil: '長い貼付材料を要約',
      optimizerAesthetic: 'スタイル方向を提案',
      optimizerPromptHeading: '最適化されたプロンプト',
      optimizerSettingsHeading: '推奨実行設定',
      adviceNeedsKey: '設定で API キーを入力してください。',
      adviceGenerating: '使用アドバイスを生成中…',
      adviceFailed: 'アドバイスの取得に失敗しました',
      adviceScopeOverall: '全体(全プロジェクト)',
      adviceScopePrompt: 'アドバイスの対象範囲を選択',
      adviceDemoButton: 'デモを見る',
      adviceDemoNotice:
        '# デモ — AI 使用アドバイス プレビュー\n\n' +
        '> **このファイルは静的デモであり、実際のアドバイスではありません。**\n' +
        '> 以下の内容は、この機能がどのような出力を生成するかを示すために\n' +
        '> 手書きされたサンプルです。あなたの実際の Claude Code 使用データ\n' +
        '> に基づくものでは**ありません** —— この内容を生成するために\n' +
        '> API にデータは送信されていません。\n\n' +
        '### あなたの実際の使用量に基づくパーソナライズされたアドバイスを取得するには:\n\n' +
        '1. 設定を開く(`Ctrl+,` / `Cmd+,`)\n' +
        '2. **`claudeCodeUsage.advice.apiKey`** を検索\n' +
        '3. OpenAI 互換 API キーを貼り付け —— DeepSeek はすぐに使えます\n' +
        '   ([deepseek.com](https://platform.deepseek.com))\n' +
        '4. **`Claude Code Usage: Get AI Usage Advice`** を再実行',
      costComposition: 'コスト構成',
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
      workspaceToday: '이 프로젝트',
      refresh: '새로고침',
      autoRefresh: '자동 새로고침',
      settings: '설정',
      settingsTab: '설정',
      settingsIntro:
        '설정이 이제 여기로 모였습니다. 언어, 데이터 디렉터리, API 키만 VS Code 설정에 남습니다(동기화를 위해). 변경은 즉시 적용됩니다.',
      settingsResetAll: '모두 기본값으로',
      settingsGroupGeneral: '일반',
      settingsGroupStatusBar: '상태 표시줄',
      settingsGroupData: '데이터 및 새로고침',
      settingsGroupAdvice: 'AI 조언 & 옵티마이저',
      totalTokens: '총 토큰 수',
      inputTokens: '입력 토큰',
      outputTokens: '출력 토큰',
      cacheCreation: '입력 캐시 (미스)',
      cacheRead: '입력 캐시 (히트)',
      cost: '비용',
      messages: '메시지 수',
      modelBreakdown: '모델별 사용량',
      dailyBreakdown: '일별 사용량',
      monthlyBreakdown: '월별 사용량',
      hourlyBreakdown: '시간별 사용량',
      sessions: '세션',
      sessionBreakdown: '세션별 사용량',
      project: '프로젝트',
      startTime: '시작 시간',
      duration: '사용 시간',
      hour: '시각',
      projects: '프로젝트',
      projectBreakdown: '프로젝트별 사용량',
      fullPath: '전체 경로',
      peakContext: '최대 컨텍스트',
      tokenComposition: '토큰 구성',
      lastActive: '마지막 활동',
      pricing: '요금',
      refreshPricing: '토큰 단가 업데이트',
      pricingUpdated: '가격이 업데이트됨',
      pricingUpdateFailed: '가격 업데이트 실패',
      sortHint: '열 머리글을 클릭하여 정렬',
      quota: '사용 한도',
      quotaWindow: '기간',
      quotaLimit: '한도',
      quota5h: '5시간',
      quotaWeekly: '주간',
      quotaHint: 'Anthropic /usage의 실제 데이터입니다.',
      contextWindow: '컨텍스트 윈도우',
      contextHint: '작업 전환 시 /clear로 컨텍스트를 초기화하세요.',
      contextLeft: '컨텍스트 여유',
      contentAnalysis: '콘텐츠',
      estimatedNote: '텍스트 길이로 추정 — 상대 비율은 신뢰할 수 있고 절대값은 근사치입니다.',
      calibratedNote: '보정됨: 카테고리별 비율은 텍스트 길이로 추정하고, 정확한 청구 토큰 총량(출력 측 / 입력＋캐시 쓰기 측)에 맞춰 스케일했습니다. analysis.calibrate로 전환.',
      calibratedTokens: '보정된 토큰',
      thinkingTokensCalibrated: '실제 사고 토큰(보정됨)',
      byTool: '도구별 결과 사용량',
      catUserPrompts: '내 입력',
      catAssistantText: '어시스턴트 응답',
      catAssistantThinking: '어시스턴트 사고',
      catToolCalls: '도구 호출',
      catToolResults: '도구 결과',
      estTokens: '추정 토큰',
      share: '비율',
      resets: '재설정',
      cacheHitRate: '캐시 적중률',
      last30days: '최근 30일',
      branches: '브랜치',
      branchBreakdown: '브랜치별 사용량',
      branch: '브랜치',
      workflows: '워크플로',
      workflowBreakdown: '워크플로별 사용량',
      workflowName: '워크플로',
      model: '모델',
      agents: '에이전트 수',
      agent: '에이전트',
      workflowsThisMonth: '이번 달 워크플로',
      workflowCostShare: '이번 달 비용 중 비율',
      workflowCacheHint:
        '캐시 적중률 = 캐시 읽기 ÷ 전체 입력측 토큰. 네이티브 Claude 워크플로는 에이전트 간 프롬프트 캐시를 재사용합니다(높은 적중률). 에이전트 간 캐시가 없는 공급자는 약 0%로, 같은 워크플로 비용이 훨씬 더 많이 듭니다.',
      adhocBadge: '서브에이전트(애드혹)',
      workflowModeBadge: '워크플로',
      workflowModeHint:
        '"워크플로" = 디스크에 동적 워크플로 실행 디렉터리가 있는 경우; "서브에이전트(애드혹)" = 일반 Task 도구 팬아웃. effort 수준(ultracode/xhigh)은 로그에 기록되지 않으므로 어느 배지도 이를 주장하지 않습니다.',
      workflowNativeHint:
        '네이티브 Claude의 ultracode는 오케스트레이션을 메인 세션에 두는 경우가 많아(에이전트 파일 없음) 여기 대신 "세션 / 사용량 추적"에 표시됩니다. 에이전트 파일을 쓰는 실행은 Claude 비용을 오케스트레이션 행에 표시합니다. (향후 릴리스에서 처리 예정.)',
      orchestration: '메인 세션 오케스트레이션',
      commonTaskPrefix: '공통 작업 텍스트',
      thinkingShare: '사고 비율',
      effortHint: '사고 비율이 높습니다 — 이런 작업에는 xhigh 대신 /effort high를 고려하세요.',
      quotaWarnBanner:
        '5시간 윈도우가 {remaining}%만 남았습니다. 워크플로 실행은 그중 큰 부분을 소비할 수 있습니다 — 리셋을 기다리는 것을 고려하세요. 중단된 실행은 프롬프트 캐시를 잃어 재실행 비용이 약 40% 더 듭니다.',
      dismiss: '닫기',
      attribution: '사용량 추적',
      attrDisclaimer:
        '이 기기의 로컬 세션 기반 근사치 — 다른 기기나 claude.ai는 포함되지 않습니다. 사용량의 독립적인 특성이며, 분해가 아닙니다.',
      attrLargeContext: '사용량의 {pct}%가 >150k 컨텍스트에서 발생했습니다',
      attrLargeContextShort: '>150k 컨텍스트',
      attrLargeContextHint:
        '긴 컨텍스트는 캐시가 있어도 더 비쌉니다. 작업 중에는 /compact, 작업 전환 시에는 /clear를 사용하세요.',
      attrLongSessions: '사용량의 {pct}%가 8시간 이상 활성 세션에서 발생했습니다',
      attrLongSessionsShort: '8시간 이상 세션',
      attrLongSessionsHint:
        '대개 백그라운드/루프 세션입니다. 지속적인 사용은 빠르게 누적되니 의도된 것인지 확인하세요.',
      attrSubagentHeavy: '사용량의 {pct}%가 서브에이전트 중심 세션에서 발생했습니다',
      attrSubagentHeavyShort: '서브에이전트 중심 세션',
      attrSubagentHeavyHint:
        '각 서브에이전트는 자체 요청을 실행합니다. 신중하게 생성하고, 단순한 작업에는 저렴한 모델을 고려하세요.',
      attrWorkflows: '사용량의 {pct}%가 워크플로 실행에서 발생했습니다',
      attrWorkflowsShort: '워크플로 실행',
      attrWorkflowsHint: '실행별 세부 정보와 캐시 적중률은 워크플로 탭에서 확인하세요.',
      attrSkillChar: '사용량의 {pct}%가 {name}에서 발생했습니다',
      attrSkillCharHint: '무거운 스킬은 범위를 줄이거나 skill frontmatter로 저렴한 모델을 지정할 수 있습니다.',
      attrPluginChar: '사용량의 {pct}%가 플러그인 "{name}"에서 발생했습니다',
      attrPluginCharHint:
        '이 플러그인의 기여를 검토하세요 — 에이전트, 스킬, MCP 도구 모두 한도에 포함됩니다.',
      attrSkills: '스킬',
      attrSubagents: '서브에이전트',
      attrPlugins: '플러그인',
      attrModels: '모델',
      attrShare: '사용량 비율',
      count: '횟수',
      scopeDay: '일',
      scopeWeek: '주',
      scopeMonth: '월',
      attrTodayPointer: '자세한 내용은 콘텐츠 탭에서',
      sessionTitle: '세션',
      getAdvice: 'AI 조언 받기',
      adviceCardTitle: 'AI 조언',
      adviceCardDesc:
        '사용량 요약 + 본인 프롬프트 샘플을 모델에 보내 더 명확한 지시와 낭비 줄이기에 대한 구체적 팁을 받습니다.',
      optimizerTitle: '사용량 옵티마이저',
      optimizerDesc:
        '대략적인 요청을 붙여넣으면 다듬어진 붙여넣기용 프롬프트와 추천 effort / thinking / 모델을 돌려줍니다. 기본 꺼짐; 붙여넣은 텍스트만 전송됩니다.',
      optimizerConsent:
        '사용량 옵티마이저는 붙여넣은 텍스트를 설정한 모델(advice.backend)로 보냅니다. Claude Code로는 전송되지 않고 터미널에도 입력되지 않습니다. 계속할까요?',
      optimizerEnableBtn: '설정에서 사용',
      optimizerPlaceholder: '최적화할 대략적인 프롬프트 붙여넣기…',
      optimizerRun: '최적화',
      optimizerRunning: '최적화 중…',
      optimizerCopy: '프롬프트 복사',
      optimizerCopied: '복사됨',
      optimizerResolve: '모호한 참조 표시',
      optimizerDistil: '긴 붙여넣기 자료 요약',
      optimizerAesthetic: '스타일 방향 제안',
      optimizerPromptHeading: '최적화된 프롬프트',
      optimizerSettingsHeading: '추천 실행 설정',
      adviceNeedsKey: '설정에서 API 키를 입력하세요.',
      adviceGenerating: '사용 조언 생성 중…',
      adviceFailed: '조언을 가져오지 못했습니다',
      adviceScopeOverall: '전체(모든 프로젝트)',
      adviceScopePrompt: '조언 범위를 선택하세요',
      adviceDemoButton: '데모 보기',
      adviceDemoNotice:
        '# 데모 — AI 사용 조언 미리보기\n\n' +
        '> **이 파일은 정적 데모이며, 실제 조언이 아닙니다.**\n' +
        '> 아래 내용은 이 기능이 어떤 종류의 출력을 생성하는지 보여주기\n' +
        '> 위해 직접 작성된 샘플입니다. 실제 Claude Code 사용 데이터에\n' +
        '> 기반하지 **않으며**, 이 내용을 생성하기 위해 API에 데이터가\n' +
        '> 전송된 적이 없습니다.\n\n' +
        '### 실제 사용량 기반의 맞춤형 조언을 받으려면:\n\n' +
        '1. 설정 열기 (`Ctrl+,` / `Cmd+,`)\n' +
        '2. **`claudeCodeUsage.advice.apiKey`** 검색\n' +
        '3. OpenAI 호환 API 키 붙여넣기 — DeepSeek 즉시 사용 가능\n' +
        '   ([deepseek.com](https://platform.deepseek.com))\n' +
        '4. **`Claude Code Usage: Get AI Usage Advice`** 다시 실행',
      costComposition: '비용 구성',
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
  private static currentDecimalPlaces: number = 2;
  private static compactNumbers: boolean = false;
  private static timezone: string = '';

  /** Locale string suitable for Intl APIs (toLocaleString, etc.). */
  static getLocale(): string {
    return this.currentLanguage;
  }

  /** IANA timezone (e.g. "Asia/Hong_Kong"), or '' to use the system zone. */
  static setTimezone(tz: string): void {
    this.timezone = typeof tz === 'string' ? tz.trim() : '';
  }

  static getTimezone(): string {
    return this.timezone;
  }

  /** Intl date-format options merged with the configured timezone (if any). */
  static dateFormatOptions(extra: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormatOptions {
    return this.timezone ? { ...extra, timeZone: this.timezone } : extra;
  }

  /** Set the number of decimal places used by formatCurrency (claudeCodeUsage.decimalPlaces). */
  static setDecimalPlaces(places: number): void {
    if (typeof places === 'number' && isFinite(places) && places >= 0 && places <= 4) {
      this.currentDecimalPlaces = Math.floor(places);
    }
  }

  /** Toggle compact number formatting, e.g. 1.2M / 345K (claudeCodeUsage.compactNumbers). */
  static setCompactNumbers(enabled: boolean): void {
    this.compactNumbers = !!enabled;
  }

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

  /** Localised + English name of the current UI language, used to instruct LLMs. */
  static getLanguageName(): string {
    switch (this.currentLanguage) {
      case 'zh-CN':
        return '简体中文 (Simplified Chinese)';
      case 'zh-TW':
        return '繁體中文 (Traditional Chinese)';
      case 'ja':
        return '日本語 (Japanese)';
      case 'ko':
        return '한국어 (Korean)';
      case 'de-DE':
        return 'Deutsch (German)';
      case 'en':
      default:
        return 'English';
    }
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

  static formatCurrency(amount: number, decimalPlaces?: number): string {
    const places = decimalPlaces != null ? decimalPlaces : this.currentDecimalPlaces;
    return `$${amount.toFixed(places)}`;
  }

  static formatNumber(num: number): string {
    if (this.compactNumbers) {
      const abs = Math.abs(num);
      if (abs >= 1_000_000_000) {
        return parseFloat((num / 1_000_000_000).toFixed(2)) + 'B';
      }
      if (abs >= 1_000_000) {
        return parseFloat((num / 1_000_000).toFixed(2)) + 'M';
      }
      if (abs >= 1_000) {
        return parseFloat((num / 1_000).toFixed(1)) + 'K';
      }
    }
    // Use the user's selected locale so the thousands separator etc. match
    // the UI language instead of the system default (addresses upstream PR #8).
    return num.toLocaleString(this.currentLanguage);
  }
}
