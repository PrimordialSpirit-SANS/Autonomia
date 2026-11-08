import type { Dictionary } from "./core";

// Deutsch: Buttons im Nominalstil, Hinweise in Höflichkeitsform.
const de: Dictionary = {
  meta: {
    title: "Autonomia Entwickler-Konsole",
    description:
      "Autonomia Entwickler-Konsole: API-Schlüssel verwalten, Streaming-Tests ausführen und Nutzung einsehen — für eine OpenAI-kompatible Inference-API.",
  },
  common: {
    language: "Sprache",
    retry: "Neu verbinden",
    cancel: "Abbrechen",
    copy: "Kopieren",
    copied: "Kopiert",
    neverUsed: "Nie verwendet",
    unlimited: "Unbegrenzt",
  },
  app: {
    checkingSession: "Anmeldestatus wird geprüft…",
  },
  home: {
    badge: "SELBST GEHOSTETES KI-GATEWAY",
    heroTitleLead: "Ein Endpunkt.",
    heroTitleEm: "Modelle nach deiner Wahl.",
    heroLead:
      "Verbinde Modelle mehrerer Anbieter mit dem vertrauten OpenAI-SDK. Routing, Schlüssel und Abrechnung bleiben auf deiner eigenen Infrastruktur.",
    appLabel: "Deine Anwendung",
    gatewayLabel: "Deine Infrastruktur",
    upstreamLabel: "Externe Modellanbieter",
    flowNote:
      "Du hostest das Gateway. Inferenzanfragen werden gemäß der Routing-Konfiguration an externe Modellanbieter weitergeleitet.",
    keysLabel: "Schlüssel",
    routingLabel: "Routing",
    billingLabel: "Abrechnung",
    pricingUnit: "USD / 1 Mio. Tokens",
    catalogNote: "Preise aus dem aktuellen Katalog, keine Live-Preisangaben der Anbieter.",
    catalogLoading: "Modellkatalog wird geladen…",
    catalogUnavailable:
      "Der Modellkatalog ist derzeit nicht verfügbar. Die Integrationsdokumentation ist weiterhin zugänglich.",
    selectModel: "Beispielmodell",
    codeFormat: "Codeformat",
    codeNote:
      "Dieses Beispiel sendet keine Anfrage automatisch. Setze vor der Ausführung die Umgebungsvariable AUTONOMIA_API_KEY.",
    dataPolicy: "Prompts und Antworten werden standardmäßig nicht gespeichert",
    catalogDate: "Katalog aktualisiert",
    skipToContent: "Zum Hauptinhalt springen",
    modelUnavailable: "Keine Chatmodelle verfügbar",
    ctaStart: "Jetzt starten",
    ctaConsole: "Konsole öffnen",
    ctaDocs: "Dokumentation lesen",
    ctaModels: "Modelle ansehen",
    factsLabel: "Kernzahlen",
    metricModels: "Modelle",
    metricProviders: "Anbieter",
    metricCompat: "OpenAI-kompatibel",
    metricLicense: "Open-Source-Lizenz",
    featuresLabel: "Kernfunktionen",
    whyTitle: "Gebaut wie Infrastruktur",
    feature1Title: "OpenAI-kompatible API",
    feature1Body:
      "Bestehende OpenAI-SDKs und Tools bleiben unverändert — baseURL austauschen, fertig. Streaming, Tool-Aufrufe, Embeddings und die Responses-Schnittstelle funktionieren wie zuvor.",
    feature2Title: "Multi-Upstream-Routing und Failover",
    feature2Body:
      "Jedes Modell kann hinter mehreren Upstreams liegen: gewichtete Verteilung und automatisches Failover bei Fehlern. Fällt ein Anbieter aus, läuft der Dienst weiter.",
    feature3Title: "Mikro-Dollar-Abrechnung und Auditing",
    feature3Body:
      "Abgerechnet in Mikro-Dollar: erst reservieren, dann abrechnen, Differenz zurückerstatten. Jede Anfrage ist nachrechenbar, die Buchhaltung geht auf.",
    feature4Title: "Self-hosted, deine Daten",
    feature4Body:
      "Mit einer einzigen SQLite-Datei starten; auf PostgreSQL oder Cloudflare Workers wachsen. Prompts und Antworten landen standardmäßig nie auf der Festplatte, Schlüssel liegen nur als Hash.",
    catalogLabel: "Katalog",
    modelsTitle: "Modelle und Preise",
    modelsDesc:
      "Vergleiche Kontextfenster und Preise pro Million Tokens und wähle das passende Modell für deinen Workload.",
    modelsLink: "Alle Modelle ansehen",
    tableModel: "Modell",
    tableProvider: "Anbieter",
    tableInput: "Eingabe",
    tableOutput: "Ausgabe",
    modelContext: "Kontext",
    providersLabel: "Unterstützte Modellanbieter",
    surfaceLabel: "API-Oberfläche",
    surfaceTitle: "Inferenz-API",
    surfaceDesc: "Drei öffentliche Inferenzschnittstellen. Nicht unterstützte Routen geben 404 zurück.",
    endpointChatDesc:
      "Chat, Streaming und Tool-Aufrufe. Die verfügbaren Funktionen hängen vom Modell und dem Upstream-Anbieter ab.",
    endpointEmbeddingsDesc: "Text-Embeddings für Vektor-Workloads, abgerechnet nur nach Input-Tokens.",
    endpointResponsesDesc:
      "Die Responses-Schnittstelle, überbrückt auf dieselbe Routing- und Abrechnungspipeline.",
    quickstartDesc:
      "Lege Gateway-URL, API-Schlüssel und Modell-ID fest. Nutze die vertraute Struktur deiner SDK-Anfragen weiter.",
    stepsLabel: "Erste Schritte",
    stepsTitle: "Endpunkt ändern.\nWeiterentwickeln.",
    stepsDesc: "Kein Umschreiben der App, keine Datenmigration.",
    step1Title: "API-Schlüssel erstellen",
    step1Body:
      "Lege in der Konsole einen sk-autonomia-Schlüssel an und setze erlaubte Modelle und Ausgabenlimit.",
    step2Title: "Modell und Beispiel auswählen",
    step2Body: "Wähle unten ein Modell und kopiere die zugehörige cURL- oder Python-Anfrage.",
    step3Title: "Nutzung prüfen",
    step3Body: "Nutzung, Latenz und Kosten in Echtzeit; ausgefallene Upstreams werden automatisch umgangen.",
    finalTitle: "KI-Dienste auf der eigenen Infrastruktur betreiben",
    finalBody:
      "Starte mit einer einzigen SQLite-Datei und wachse nach Bedarf. Self-hosted, beobachtbar und auf den Cent genau abgerechnet — Modelle und Daten bleiben unter deiner Kontrolle.",
  },
  nav: {
    consoleNav: "Konsolen-Navigation",
    publicNav: "Navigation öffentlicher Seiten",
    footerNav: "Fußzeilen-Navigation",
    groupUse: "Nutzung",
    groupResources: "Ressourcen",
    groupDocs: "Dokumentation",
    overview: "Übersicht",
    playground: "Streaming-Test",
    keys: "API-Schlüssel",
    models: "Modelle",
    logs: "Anfrageprotokoll",
    quickstart: "Schnellstart",
    balance: "Guthaben {amount}",
    logout: "Abmelden",
    logoutFailed:
      "Die Abmeldung wurde nicht abgeschlossen — das Sitzungs-Cookie ist noch aktiv. Bitte erneut versuchen.",
    home: "Startseite",
    docs: "Dokumentation",
    login: "Anmelden",
    loginOrRegister: "Anmelden / Konto erstellen",
    footerTagline: "Autonomia — Self-hosted AI Gateway",
  },
  login: {
    workspaceLead: "Ihre Modelle.",
    workspaceEm: "Ihr Arbeitsbereich.",
    workspaceDescription:
      "Verwalten Sie API-Schlüssel, verfolgen Sie die Nutzung und prüfen Sie Anfragen an einem Ort.",
    exploreLabel: "Vor der Anmeldung mehr erfahren",
    showPassword: "Passwort anzeigen",
    hidePassword: "Passwort ausblenden",
    passwordHint: "Verwenden Sie mindestens 8 Zeichen.",
    title: "Autonomia Konsole",
    subtitleLogin: "Melden Sie sich an, um API-Schlüssel und Nutzung zu verwalten",
    subtitleRegister: "Erstellen Sie ein neues Konto, um Autonomia zu nutzen",
    email: "E-Mail-Adresse",
    username: "Benutzername",
    usernamePlaceholder: "Ihr Anzeigename",
    password: "Passwort",
    passwordPlaceholder: "Mindestens 8 Zeichen",
    acceptedNotice:
      "Registrierung entgegengenommen. Wenn diese E-Mail-Adresse noch nicht verwendet wird, wurde das Konto erstellt — melden Sie sich damit an. Wenn Sie bereits ein Konto haben, melden Sie sich einfach an.",
    submitLogin: "Anmelden",
    submitRegister: "Konto erstellen",
    submitting: "Wird verarbeitet…",
    noAccount: "Noch kein Konto?",
    haveAccount: "Haben Sie bereits ein Konto?",
    registerCta: "Neues Konto erstellen",
    loginCta: "Stattdessen anmelden",
    backHome: "← Zurück zur Startseite",
  },
  overview: {
    title: "Übersicht",
    subtitle: "Konto- und Nutzungszusammenfassung der letzten 30 Tage",
    greeting: "Willkommen zurück, {name}",
    createKey: "API-Schlüssel erstellen",
    metricsAria: "Nutzungszusammenfassung der letzten 30 Tage",
    metricBalance: "Verfügbares Guthaben",
    metricRequests: "Anfragen (30 Tage)",
    metricTokens: "Token (30 Tage)",
    metricSpend: "Ausgaben (30 Tage)",
    loading: "Nutzungszusammenfassung wird geladen…",
    endpointTitle: "API-Endpunkt",
    endpointIntro:
      "Kompatibel mit OpenAI Chat Completions — richten Sie beliebige OpenAI-SDKs auf die folgende Base URL.",
    baseUrlLabel: "Base URL",
    quickTitle: "Häufige Aktionen",
    quickPlaygroundHint: "Antworten in Echtzeit ansehen",
    quickDocsHint: "Aufrufbeispiele ansehen",
    quickModelsHint: "Modelle und Preise ansehen",
    quickLogsHint: "Nutzung und Status ansehen",
    statPeriodDays: "Zeitraum: letzte {days} Tage",
    statSuccessFail: "{succeeded} erfolgreich・{failed} fehlgeschlagen",
    statInOut: "{input} rein・{output} raus",
    statAvgCost: "{cost} ø pro Anfrage",
    endpointPostDesc: "Chat Completions (Streaming unterstützt)",
    endpointGetDesc: "Verfügbare Modelle auflisten",
    freeQuotaTitle: "Kostenloses Modell-Kontingent",
    freeQuotaIntro:
      "Nutzung des Gratis-Kontingents pro Modell im aktuellen Zeitraum; darüber hinaus wird vom Guthaben abgerechnet.",
    freeQuotaUsedOf: "{used} / {limit} Anfragen",
  },
  keys: {
    title: "API-Schlüssel",
    subtitle:
      "Schlüssel werden nur einmal angezeigt — bei Erstellung oder Rotation. Speichern Sie ihn sofort sicher.",
    createTitle: "Neuen Schlüssel erstellen",
    createIntro: "Vergeben Sie für jede Umgebung eigene Ablaufzeiten und Ausgabenbudgets (USD).",
    nameLabel: "Schlüsselname",
    nameHint: "Verwenden einen gut erkennbaren Dienst- oder Umgebungsnamen.",
    expiryLabel: "Ablaufzeit",
    expiryChoiceAria: "Ablaufmodus des Schlüssels",
    expiryInputAria: "Ablaufzeit des Schlüssels",
    neverExpires: "Läuft nie ab",
    expiryCustom: "Eigenes Datum",
    expiryMinHint: "Der früheste mögliche Zeitpunkt ist eine Stunde ab jetzt.",
    expiryDefaultHint: "Der Schlüssel bleibt gültig, bis Sie ihn manuell widerrufen.",
    limitLabel: "Ausgabenlimit (USD)",
    limitChoiceAria: "Ausgabenlimit",
    limitUnlimited: "Unbegrenzt",
    limitSet: "Limit festlegen",
    limitHint:
      "Sobald die kumulierten Ausgaben dieses Schlüssels das Limit erreichen, werden neue Anfragen abgelehnt.",
    limitDefaultHint: "Begrenzt nicht, wie viel dieser Schlüssel ausgeben darf.",
    replayLabel: "Idempotentes Replay",
    replayChoiceAria: "Idempotentes Replay",
    replayInputAria: "Replay-Gültigkeit (Stunden)",
    replayOff: "Aus (Standard)",
    replayOn: "Speichern & wiedergeben",
    replayOnHint:
      "Erfolgreiche Antworten werden für diese Gültigkeit gespeichert (maximal 7 Tage). Wird derselbe Idempotency-Key mit identischem Anfragekörper erneut gesendet, wird die gespeicherte Antwort wiedergegeben — ohne erneute Abrechnung.",
    replayOffHint:
      "Antworten werden nicht gespeichert; das erneute Senden eines abgeschlossenen Schlüssels ergibt 409, Anfrageinhalte werden nie gespeichert.",
    footerHint:
      "Schlüssel werden nur einmal angezeigt — speichern Sie ihn direkt nach der Erstellung sicher.",
    createButton: "Schlüssel erstellen",
    creating: "Wird erstellt…",
    listAria: "Schlüsselliste",
    loading: "Schlüssel werden geladen…",
    empty: "Noch keine Schlüssel. Erstellen Sie den ersten Schlüssel, um die API aufzurufen.",
    metaCreated: "Erstellt {time}",
    metaLastUsed: "Zuletzt verwendet {time}",
    metaExpires: "Läuft ab {time}",
    metaSpend: "Ausgaben {used} / {limit}",
    metaReplay: "Idempotentes Replay {value}",
    rpmLabel: "Anfragen pro Minute (RPM)",
    rpmUseDefault: "Standard (60)",
    setCustom: "Benutzerdefiniert",
    rpmDefaultHint: "Standardmäßig 60 Anfragen pro Minute.",
    inFlightLabel: "Gleichzeitige Anfragen",
    inFlightUseDefault: "Standard (4)",
    inFlightDefaultHint: "Standardmäßig 4 gleichzeitige Anfragen.",
    rangeHint: "Zulässiger Bereich {min}-{max}.",
    errorRange: "{field} muss eine ganze Zahl zwischen {min} und {max} sein.",
    allowlistLabel: "Model-Allowlist",
    allowlistHint: "Modell-ids durch Kommas getrennt; leer lassen, um alle Modelle zuzulassen.",
    metaLimits: "Rate {rpm} req/min · Parallel {inFlight}",
    metaAllowlist: "Modelle: {value}",
    allowlistModelCount: "{count} erlaubt",
    allowlistAllModels: "alle",
    errorAllowlist: "Die Model-Allowlist ist ungültig — nur kommagetrennte Modell-ids.",
    replayOffShort: "Aus",
    replayHours: "{hours} Std.",
    rotate: "Rotieren",
    revoke: "Widerrufen",
    secretTitle: "Diesen Schlüssel jetzt kopieren",
    secretBody:
      "Nach dem Schließen ist er nicht mehr sichtbar. Speichern Sie ihn in einem Passwort-Manager oder als Server-Umgebungsvariable.",
    copyKey: "Schlüssel kopieren",
    savedIt: "Ich habe ihn sicher gespeichert",
    revokeTitle: "„{name}“ widerrufen?",
    revokeBody:
      "Anfragen mit diesem Schlüssel schlagen sofort fehl. Diese Aktion kann nicht rückgängig gemacht werden.",
    revokeConfirm: "Widerrufen bestätigen",
    errorExpiry: "Die Ablaufzeit muss mindestens 1 Stunde in der Zukunft liegen.",
    errorLimit: "Das Ausgabenlimit muss ein Betrag von 0 oder mehr (USD) sein.",
    errorReplayTtl: "Die Replay-Gültigkeit muss zwischen 1 und {max} Stunden (7 Tage) liegen.",
  },
  logs: {
    title: "Anfrageprotokoll",
    subtitle: "Klicken Sie auf eine Zeile, um die Details einer Anfrage zu sehen",
    filterAria: "Nach Status filtern",
    filterAll: "Alle Status",
    colTime: "Zeit",
    colModel: "Modell",
    colStatus: "Status",
    colTokens: "Token",
    colSpend: "Ausgaben",
    colLatency: "Latenz",
    loading: "Anfrageprotokoll wird geladen…",
    empty: "Noch keine Anfragen protokolliert.",
    loadMore: "Mehr laden",
    defaultKeyName: "API-Schlüssel",
    detailTitle: "Anfragedetails",
    detailAria: "Anfragedetails",
    detailCloseAria: "Anfragedetails schließen",
    detailClose: "Schließen",
    detailStatus: "Status",
    detailRequestedModel: "Angefordertes Modell",
    detailActualModel: "Tatsächliches Modell",
    detailProvider: "Anbieter",
    detailInputTokens: "Eingabe-Token",
    detailOutputTokens: "Ausgabe-Token",
    detailCharge: "Abgerechneter Betrag",
    detailLatency: "Gesamtlatenz",
    detailErrorCode: "Fehlercode",
    detailReplayOf: "Replay von",
    statusSucceeded: "Erfolgreich",
    statusPartiallySucceeded: "Teilweise erfolgreich",
    statusRejected: "Abgelehnt",
    statusRefunded: "Erstattet",
    statusDispatched: "In Bearbeitung",
    statusNeedsReconciliation: "Abstimmung ausstehend",
    statusReplayed: "Wiedergegeben",
  },
  models: {
    title: "Modelle",
    subtitle: "{count} Modelle · Preisrevision {revision}",
    loading: "Modellkatalog wird geladen…",
    contextLabel: "Kontext {value}",
    routeTitle: "Modell-Route {id}",
    routeCopyLabel: "Modell-Route kopieren",
    modalityVisionDesc:
      "Dieses Modell unterstützt nativ multimodale Eingaben; die Autonomia API bietet derzeit eine Textschnittstelle.",
    modalityTextDesc: "Dieses Modell unterstützt keine multimodalen Bildeingaben.",
    billingInput: "Eingabe / 1M Token",
    billingOutput: "Ausgabe / 1M Token",
  },
  // Modellbeschreibungen: Schlüssel ist die vollständige Modell-ID, gelesen über
  // modelDescription() (keine Punkt-Pfad-Suche).
  modelDescriptions: {
    "autonomia/gpt-6-astra":
      "OpenAIs neues Flaggschiff «Astra», im September 2026 veröffentlicht — bei langlaufenden Agentenaufgaben und komplexem Denken deutlich stärker als der Vorgänger. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/gpt-6.1-sol":
      "Das neueste Universalmodell der GPT-6-Sol-Generation — professionelles Denken und alltägliche Agentenarbeit zu ausgewogenen Kosten. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/gpt-5.3-codex":
      "OpenAis stärkstes Codiermodell — langlaufendes Denken für große Refactorings und agentenartige Entwicklungsaufgaben. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/claude-fable-5-1":
      "Anthropics neue Fable-Stufe oberhalb von Opus — gebaut für das tiefste Denken und die längsten Agentenaufgaben. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/claude-opus-5-5":
      "Die aktuelle Generation der Claude-Opus-Reihe — ideal für tiefes Denken und langlaufende Agentenarbeit. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/claude-sonnet-5-5":
      "Die neueste Sonnet-Generation: agentenorientiertes Coden und alltägliche Profiarbeiten zu Flaggschiff-naher Leistung und niedrigerem Preis. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/claude-haiku-5-5":
      "Das schnellste Modell der Claude-Familie — Sonnet-nahe Agenten- und Code-Leistung zu neuem Tiefpreis und minimaler Latenz. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/gemini-4-argon":
      "Das erste Flaggschiff der Gemini-4-Reihe von Google DeepMind — «Argon» mit nativ multimodalem Denken und vereinheitlichtem 1M-Token-Kontext. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/gemini-3.8-flash":
      "Das neueste Flash-Modell der Gemini-3-Serie — gebaut für langlaufende Softwareentwicklung und autonome Agenten, mit Balance aus Tempo und Denkleistung. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/gemini-3.5-flash-lite":
      "Das schnellste und günstigste Modell der Gemini-3.5-Familie für durchsatzstarke, latenzarme Workloads. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/grok-4.7":
      "xAIs aktuelles Flaggschiff, veröffentlicht im September 2026 — beim Coden und komplexen Denken durchgängig stärker als der Vorgänger. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/grok-4.3":
      "xAIs effiziente Stufe — ausgewogenes Denken über einen 1M-Token-Kontext zu geringeren Kosten. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/deepseek-v4-pro":
      "DeepSeeks V4-Flaggschiff für Denken — stark beim Coden, in der Mathematik und bei komplexen Aufgaben. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/deepseek-v4.1-flash":
      "Ein offenes, effizientes Modell von DeepSeek aus September 2026 — unter MIT-Lizenz mit Million-Token-Kontext. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/kimi-k3":
      "Moonshot AIs offenes Flaggschiff von Juli 2026 — 2,8 Billionen Parameter (MoE) mit nativem Sehverständnis. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/glm-5.3":
      "Z.ais offenes Flaggschiff von August 2026 — 50 % stärker beim Coden als GLM-5.2, mit Million-Token-Kontext. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/glm-5.3-flash":
      "Das erste nativ multimodale Modell der GLM-5-Reihe — 320B Gesamtparameter, nur 18B aktiv, gebaut für günstige Agenten-Deployments. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/qwen-3.8-max":
      "Alibabas Qwen3.8-Flaggschiff von August 2026 — rund 2,4 Billionen Parameter, stark bei autonomem Coden und langlaufender Softwareentwicklung. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/qwen-3.8-flash":
      "Die effiziente multimodale Variante der Qwen3.8-Familie — Denkleistung bei niedrigeren Kosten und weniger Latenz. Autonomia bietet derzeit Schnittstellen für Text-Chat, Streaming und Tool-Aufrufe.",
    "autonomia/qwen-3.8-27b":
      "Ein leichtes offenes Vision-Language-Modell der Qwen3.8-Reihe, über Cloudflare Workers AI mit sehr geringer Latenz für Alltags-Chat, Bildverständnis und Textaufgaben. Autonomia bietet derzeit Schnittstellen für Text-Chat und Streaming.",
    "autonomia/text-embedding-3-small":
      "OpenAIs preisgünstiges Text-Embedding-Modell für semantische Suche, Klassifikation und RAG-Retrieval. Über den Endpunkt /v1/embeddings nutzbar; nur Eingabe-Token werden abgerechnet.",
    "autonomia/text-embedding-3-large":
      "OpenAIs hochwertigstes Text-Embedding-Modell für semantische Suche und RAG-Szenarien mit höherem Recall. Über den Endpunkt /v1/embeddings nutzbar; nur Eingabe-Token werden abgerechnet.",

    "autonomia/llama-4-maverick":
      "Metas Llama-4-Flaggschiff: multimodales MoE-Modell (17B aktiv, 128 Experten) mit nativer Text- und Bildeingabe.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/llama-4-scout":
      "Metas leichtes Llama-4-MoE-Multimodalmodell mit branchenweit führendem Langkontextfenster.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/phi-4":
      "Microsofts kleines, hocheffizientes Modell, das größere Modelle bei Mathe- und Reasoning-Benchmarks herausfordert.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/seed-1.6":
      "ByteDance Seeds multimodales Flaggschiff mit starker visueller Verarbeitung und agentischer Aufgabenplanung.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/mimo-v2.5-pro":
      "Xiaomis MiO-Flaggschiff-Reasoningmodell mit Million-Token-Kontext und tiefem Denkmodus.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/ling-3.1-flash":
      "inclusionAIs offenes Ling 3.1 Flash: extrem niedrige Latenz und Million-Token-Kontexte.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/solar-pro4":
      "Upstage Solar Pro 4: offenes Langkontextmodell, optimiert für Koreanisch und multilinguale Workloads.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/hermes-4-405b":
      "Nous Research' offenes Hermes 4 (405B), bekannt für Alignment-Qualität und agentische Tool-Aufrufe.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/lfm-2.5-24b-a2b":
      "Liquid AIs LFM 2.5 (24B-A2B) mit Hybridarchitektur: Speichereffizienz und Inferenzgeschwindigkeit im Gleichgewicht.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/mercury-3":
      "Inceptions diffusionsbasiertes Mercury 3: ultraniedrige Latenz über Million-Token-Kontexte dank paralleler Dekodierung.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/inkling":
      "Thinking Machines Labs Inkling: Modell der neuen Generation für Long-Chain-Reasoning und agentische Aufgaben.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/fugu-max":
      "Sakana AIs multimodales Flaggschiff, mit Modell-Fusionstechniken und Million-Token-Kontext gebaut.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/reka-flash-3":
      "Reka Flash 3: offenes Modell, das Geschwindigkeit und Qualität des Alltags-Reasonings ausbalanciert.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/palmyra-x5":
      "Writers Palmyra X5: Million-Kontext-Modell für Enterprise-RAG und Langdokument-Workflows.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/granite-4.2-8b":
      "IBM Granite 4.2 (8B): leichtes offenes Modell, auf Unternehmensdaten trainiert, für Klassifikation und Zusammenfassung.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/hunyuan-a13b":
      "Tencents offenes Hunyuan-A13B-MoE-Modell: kostengünstiger Allround-Chat und Reasoning mit 13B aktiven Parametern.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/deepseek-v3.1":
      "DeepSeek V3.1: offenes Flaggschiff, das Alltagschat und Reasoning vereint, mit Doppel-Routing über den offiziellen Endpunkt und OpenRouter.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/deepseek-r1":
      "DeepSeek R1: offenes Reasoning-Flaggschiff, trainiert mit Reinforcement Learning, mit Doppel-Routing.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/kimi-k2.5":
      "Moonshot AIs Kimi K2.5: offenes Flaggschiff, optimiert für agentische Aufgaben und Werkzeugnutzung.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/kimi-k2-thinking":
      "Kimi K2 Thinking: Moonshots Deep-Reasoning-Variante mit verschachteltem Denken und Tool-Aufrufen.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/glm-4.6":
      "Z.ais GLM-4.6: offenes Flaggschiff mit deutlich verbessertem Coding und agentischen Fähigkeiten, mit Doppel-Routing.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/glm-4.5-air":
      "GLM-4.5 Air: hält die meisten Flaggschiff-Fähigkeiten zu einem Bruchteil der Kosten, mit Doppel-Routing.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/qwen-plus":
      "Alibabas Qwen-Plus: ausgewogenes Modell mit Million-Token-Kontext und starkem Preis-Leistungs-Verhältnis, mit Doppel-Routing.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/minimax-m2":
      "MiniMax M2: offenes MoE-Flaggschiff mit kosteneffizienter agentischer und Reasoning-Leistung.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/step-3.7-flash":
      "StepFuns Step 3.7 Flash: kosteneffizientes Modell, das Geschwindigkeit und multimodales Verständnis ausbalanciert.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/devstral":
      "Mistrals Devstral 2: Coding-Modell für agentisches Software-Engineering im SWE-Bench-Stil.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/command-a":
      "Cohere Command A: durchsatzstarkes Instruction-Modell für Enterprise-RAG und multilinguale Workloads.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/sonar-pro":
      "Perplexity Sonar Pro: Suchmodell mit Live-Web-Retrieval und quittierten Antworten, mit Doppel-Routing.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/nemotron-3-ultra":
      "NVIDIA Nemotron 3 Ultra (550B-A55B): offenes Reasoning-Flaggschiff, optimiert für wissenschaftliches und programmatisches Denken.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/nova-premier":
      "Amazon Nova Premier: AWS' multimodales Flaggschiff für komplexe Dokumente, Bilder und Videoverständnis.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/nova-lite":
      "Amazon Nova Lite: AWS' ultragünstiges Multimodalmodell für durchsatzstarke visuelle Verarbeitung.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/kimi-k3.1-pro":
      "Moonshots Kimi K3.1 Pro: Langkontext-Flaggschiff mit Bild- und Videoeingabe, über Novitas direkten Endpunkt.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/hy4":
      "Tencent Hunyuan 4 (Hy4) offizielle Version: Million-Token-Kontext und multimodales Verständnis, über Novitas direkten Endpunkt.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/mimo-v2.6-flash":
      "Xiaomi MiMo v2.6 Flash: schnelles Reasoning-Modell mit Bild-, Video- und Audioeingabe, doppelt geroutet über Novita und OpenRouter.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/mimo-v2.6-pro":
      "Xiaomi MiMo v2.6 Pro Flaggschiff: tiefes Reasoning mit multimodaler Eingabe, doppelt geroutet über Novita und OpenRouter.Über Autonomia mit Text-Chat und Streaming verfügbar.",
    "autonomia/minimax-m3.1-flash":
      "MiniMax M3.1 Flash: schnelles Reasoning-Modell der nächsten Generation mit Bild- und Videoeingabe, über Novitas direkten Endpunkt.Über Autonomia mit Text-Chat und Streaming verfügbar.",
  },
  docs: {
    title: "Schnellstart",
    subtitle:
      "Senden Sie Ihre erste Anfrage in vier Schritten; das Antwortformat ist kompatibel mit OpenAI Chat Completions.",
    step1Title: "Schlüssel erstellen",
    step1Body:
      "Erstellen Sie auf der Seite „API-Schlüssel“ einen Schlüssel und speichern Sie das Secret sicher.",
    step2Title: "Umgebungsvariable setzen",
    step3Title: "Modell wählen",
    step4Title: "Anfrage senden",
    step4Body: "Die Beispiele unten lassen sich in jeder der Sprachen direkt ausführen.",
    tabsAria: "Programmiersprache",
    idempotencyTitle: "Idempotency-Key-Semantik",
    idempotencyIntro:
      "Idempotenz-Schlüssel verhindern, dass dieselbe Anfrage doppelt ausgeführt und doppelt abgerechnet wird. Standardmäßig (Replay aus) speichert Autonomia weder Prompts noch Completions: Das erneute Senden eines abgeschlossenen Schlüssels ergibt ",
    idempotencyReplayedNote: " (mit der ursprünglichen X-Request-Id), ein noch laufender Schlüssel ergibt ",
    idempotencyReplayOpen: ". Sobald ",
    idempotencyReplayBody:
      " für einen Schlüssel aktiviert ist, werden erfolgreiche Antworten für diese Gültigkeit gespeichert: Innerhalb der Gültigkeit wird beim erneuten Senden desselben Schlüssels mit identischem Körper die ursprüngliche Antwort wiedergegeben; nach Ablauf wird die Bindung freigegeben und ein erneutes Senden gilt als neue Anfrage (erneute Abrechnung). Antworten über 2 MB können nicht gespeichert werden; ein erneutes Senden mit demselben Schlüssel innerhalb der Gültigkeit ergibt ",
    idempotencyTail:
      " (mit einem neuen Schlüssel ist sofortige erneute Ausführung möglich). Clients, die auf idempotentes Replay angewiesen sind, sollten 409 als Endergebnis behandeln, nicht als wiederholbaren Fehler.",
  },
  playground: {
    title: "Streaming-Test",
    subtitle: "Prüfen Sie Modellantworten in Echtzeit an einem OpenAI-kompatiblen Endpunkt",
    settingsTitle: "Anfrage",
    charCount: "{count} Zeichen",
    statusIdle: "Bereit",
    statusConnecting: "Verbindung wird hergestellt",
    statusStreaming: "Wird generiert",
    statusComplete: "Abgeschlossen",
    statusStopped: "Gestoppt",
    statusError: "Fehler",
    authLabel: "Authentifizierung",
    authChoiceAria: "Authentifizierung",
    authAccount: "Anmeldesitzung",
    authApiKey: "API-Schlüssel",
    authAccountHint: "Kein Schlüssel nötig — der Test nutzt direkt Ihr Kontoguthaben.",
    authApiKeyHint:
      "Geben Sie einen dedizierten sk-autonomia-live_…-Schlüssel ein, um den öffentlichen Endpunkt zu testen.",
    modelLabel: "Modell",
    modelPlaceholder: "Modell-Route eingeben",
    modelEmpty: "Kein passendes Modell — die aktuelle Eingabe kann direkt verwendet werden",
    maxTokensLabel: "Max. Ausgabe-Token",
    messageLabel: "Nachricht",
    messagePlaceholder: "Nachricht eingeben",
    presetIntroLabel: "Stell dich vor",
    presetIntroPrompt: "Hallo! Stelle dich kurz vor und beschreibe, wobei du helfen kannst.",
    presetPoemLabel: "Gedicht schreiben",
    presetPoemPrompt: "Schreibe ein kurzes Gedicht über den Herbsthimmel bei Nacht.",
    presetCodeLabel: "Code",
    presetCodePrompt:
      "Schreibe in Python eine schnelle Funktion zur Primzahlprüfung, mit Beispielen und Kommentaren.",
    run: "Generierung starten",
    running: "Wird generiert…",
    stop: "Stoppen",
    responseTitle: "Antwort",
    clear: "Leeren",
    metricChars: "Zeichen",
    metricTokens: "Ausgabe-Token",
    metricFirstDelta: "Erster Block",
    metricElapsed: "Dauer",
    placeholderReasoning: "Denkvorgang läuft…",
    placeholderWaiting: "Warte auf den ersten Block…",
    placeholderStopped: "Generierung gestoppt.",
    placeholderIdle: "Noch nicht gestartet",
    reasoningChars: "{chars} Zeichen Reasoning",
    reasoningTokens: " · {tokens} Reasoning-Token (in der Ausgabe enthalten)",
    reasoningCharsNote: "(Zeichenanzahl entspricht nicht der Token-Anzahl)",
    errorApiKey: "Geben Sie einen API-Schlüssel ein.",
    errorModel: "Wählen oder geben Sie ein Modell zum Testen ein.",
    errorMessage: "Geben Sie eine Nachricht ein.",
    streamFailed: "Der Autonomia Streaming-Test ist fehlgeschlagen.",
  },
  catalog: {
    modelsName: "Modellkatalog",
    offeringsName: "Anbieter- und Preiskatalog",
    brandName: "Marken-Asset-Manifest",
  },
  errors: {
    invalid_request: "Ungültige Autonomia-Anfrage — bitte prüfen und erneut versuchen.",
    unsupported_parameter: "Die Anfrage enthält einen Parameter, den Autonomia nicht unterstützt.",
    unsupported_feature: "Die angeforderte Autonomia-Funktion wird nicht unterstützt.",
    invalid_api_key: "Der Autonomia API-Schlüssel ist ungültig oder abgelaufen.",
    authentication_required: "Melden Sie sich zuerst an, um Autonomia zu verwenden.",
    insufficient_scope: "Dieser API-Schlüssel verfügt nicht über die erforderliche Autonomia-Berechtigung.",
    access_denied: "Diese Autonomia-Funktion ist derzeit nicht verfügbar.",
    csrf_token_invalid:
      "Cross-Site-Anfrage abgelehnt (CSRF) — bitte laden Sie die Seite neu; falls es bestehen bleibt, prüfen Sie FRONTEND_ORIGINS am Gateway.",
    origin_forbidden:
      "Anfrage-Ursprung nicht erlaubt — fügen Sie die Herkunft dieser Konsole zu FRONTEND_ORIGINS am Gateway hinzu.",
    unexpectedError: "Unerwarteter Fehler",
    unexpectedErrorBody:
      "Beim Rendern dieser Seite ist ein Problem aufgetreten. Laden Sie die Seite neu, um fortzufahren — Ihre Daten sind serverseitig sicher.",
    reloadPage: "Seite neu laden",
    model_not_found: "Das angeforderte Autonomia-Modell wurde nicht gefunden.",
    model_not_allowed: "Dieser API-Schlüssel darf das angeforderte Autonomia-Modell nicht verwenden.",
    spend_limit_exceeded: "Dieser API-Schlüssel hat sein Ausgabenlimit erreicht.",
    insufficient_balance: "Das Autonomia-Guthaben reicht nicht aus, um diese Anfrage abzuschließen.",
    free_quota_exceeded: "Das Autonomia-Freikontingent ist aufgebraucht.",
    rate_limit_exceeded: "Zu viele Autonomia-Anfragen — bitte später erneut versuchen.",
    max_in_flight_exceeded:
      "Das Limit gleichzeitiger Autonomia-Anfragen ist erreicht — bitte später erneut versuchen.",
    request_cancelled: "Die Autonomia-Anfrage wurde abgebrochen.",
    service_unavailable:
      "Autonomia kann diese Anfrage derzeit nicht abschließen — bitte später erneut versuchen.",
    request_failed: "Autonomia konnte diese Anfrage nicht abschließen — bitte später erneut versuchen.",
    not_found: "Der angeforderte Autonomia-Datensatz wurde nicht gefunden.",
    conflict: "Autonomia konnte diese Änderung nicht anwenden — bitte aktualisieren und erneut versuchen.",
    connection_error: "Autonomia ist derzeit nicht erreichbar — bitte später erneut versuchen.",
    invalid_response: "Autonomia hat eine nicht verarbeitbare Antwort zurückgegeben.",
    invalid_stream_payload: "Autonomia hat Streamdaten zurückgegeben, die nicht geparst werden konnten.",
    invalid_stream_response: "Autonomia hat keinen gültigen Stream zurückgegeben.",
    stream_interrupted: "Der Autonomia-Stream wurde unterbrochen — bitte später erneut versuchen.",
    stream_truncated: "Der Autonomia-Stream endete vor dem Abschluss.",
    AI_KEY_LIMIT: "Das Autonomia-Schlüssellimit ist erreicht.",
    INVALID_AI_KEY_OPTIONS: "Die Autonomia-Schlüsseleinstellungen sind ungültig.",
    AI_KEY_UNAVAILABLE: "Die Autonomia-Schlüsselverwaltung ist derzeit nicht verfügbar.",
    INVALID_AI_KEY_ID: "Die Autonomia-Schlüssel-ID ist ungültig.",
    AI_KEY_NOT_FOUND: "Der angeforderte Autonomia-Schlüssel wurde nicht gefunden.",
    INVALID_AI_USAGE_QUERY: "Die Autonomia-Nutzungsabfrage ist ungültig.",
    AI_USAGE_UNAVAILABLE: "Die Autonomia-Nutzungsdaten sind derzeit nicht verfügbar.",
    USER_NOT_FOUND: "Das Autonomia-Konto wurde nicht gefunden.",
    AI_REQUEST_NOT_FOUND: "Die angeforderte Autonomia-Anfrage wurde nicht gefunden.",
    authRequestFailed: "Der Vorgang ist fehlgeschlagen — bitte später erneut versuchen.",
    authConnectionFailed: "Verbindung zum Server nicht möglich — bitte den Gateway-Status prüfen.",
    streamNoSse: "Autonomia hat keinen SSE-Stream zurückgegeben.",
    unsupportedStreamData: "Autonomia hat nicht unterstützte Streamdaten zurückgegeben.",
    enterApiKey: "Geben Sie einen API-Schlüssel ein.",
    chooseModel: "Wählen Sie ein Modell.",
    enterMessage: "Geben Sie eine Nachricht ein.",
    catalogUnsupportedFormat: "{name}: nicht unterstützte Katalogformat-Version.",
    catalogLoadFailed: "{path} konnte nicht geladen werden (HTTP {status}).",
    catalogModelsMissing: "Im Modellkatalog fehlen Pflichtfelder.",
    catalogOfferingsMissing: "Im Anbieter- und Preiskatalog fehlen Pflichtfelder.",
    catalogBrandMissing: "In der Marken-Asset-Manifest-Datei fehlen Pflichtfelder.",
  },
};

export { de };
