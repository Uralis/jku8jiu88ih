/*! Ural Pro Helper JS v0.26 */
class UralProHelperJS {
    constructor(config = {}) {
        let newConfig = {
            errorTracking: false,
            panelFPS: false,
            disableLoggingHtml: false,
            enableLoggingLib: false,
            saveIdArray: [],
            codeAfterSaving: null,
            audioMuteDocumentVisibility: true,
            purchaseFunctionList: [],
            // Новые настройки для сжатия данных
            enableCompression: false, // Включить сжатие данных
            compressionThreshold: 100, // Минимальный размер данных для сжатия (в символах)
            compressKeys: [], // Список ключей, которые нужно сжимать (если пустой - сжимать все)
            enableCompressionLogging: false, // Включить логирование операций сжатия/распаковки
            // Настройки для менеджера сохранений
            enableSaveManager: false, // Разрешить работу с менеджером сохранений
            showSaveManagerButton: false // Показывать кнопку менеджера сохранений
        };

        Object.keys(config).forEach(key => {
            newConfig[key] = config[key];
        });

        if (this.vkApi && typeof this.vkApi === 'object') this.vkApi._helper = this;

        this.uralpro = {
            config: newConfig,

            mapDataSDKSymbol: Symbol('mapDataSDK'),
            mapDataSDK: new Map(),
            save_id000: "DataPro",
            save_idArray: Array.isArray(config.saveIdArray) ? config.saveIdArray : [],
            timeoutId_saveData: null,

            // Новые методы для работы со сжатием
            isLZStringAvailable: () => {
                return typeof LZString !== 'undefined';
            },

            // Метод для определения, нужно ли сжимать данные
            shouldCompress: (key, value) => {
                if (!this.uralpro.config.enableCompression) return false;
                if (!this.uralpro.isLZStringAvailable()) return false;
                
                // Если указаны конкретные ключи для сжатия
                if (this.uralpro.config.compressKeys.length > 0) {
                    return this.uralpro.config.compressKeys.includes(key);
                }
                
                // Проверяем размер данных
                const dataString = typeof value === 'string' ? value : JSON.stringify(value);
                return dataString.length >= this.uralpro.config.compressionThreshold;
            },

            // Метод для сжатия данных
            compressData: (data) => {
                if (!this.uralpro.isLZStringAvailable()) {
                    this.uralpro.error("LZString не доступен для сжатия данных");
                    return data;
                }
                
                try {
                    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
                    const compressed = LZString.compressToEncodedURIComponent(dataString);
                    
                    // Добавляем префикс для идентификации сжатых данных
                    const result = `COMPRESSED:${compressed}`;
                    
                    // Логируем только если включено логирование сжатия
                    if (this.uralpro.config.enableCompressionLogging) {
                        this.uralpro.log(`Данные сжаты: ${dataString.length} → ${result.length} символов (${Math.round((1 - result.length / dataString.length) * 100)}% экономии)`, 
                            `style: color: #2e2727; font-weight: bold; background-color: #4CAF50; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                    }
                    
                    return result;
                } catch (error) {
                    this.uralpro.error("Ошибка сжатия данных:", error);
                    return data;
                }
            },

            // Метод для распаковки данных
            decompressData: (data) => {
                if (!this.uralpro.isLZStringAvailable()) {
                    this.uralpro.error("LZString не доступен для распаковки данных");
                    return data;
                }
                
                if (typeof data !== 'string' || !data.startsWith('COMPRESSED:')) {
                    return data; // Данные не сжаты
                }
                
                try {
                    const compressedData = data.substring(11); // Убираем префикс "COMPRESSED:"
                    const decompressed = LZString.decompressFromEncodedURIComponent(compressedData);
                    
                    if (decompressed === null) {
                        this.uralpro.error("Ошибка распаковки данных - данные повреждены");
                        return data;
                    }
                    
                    // Логируем только если включено логирование сжатия
                    if (this.uralpro.config.enableCompressionLogging) {
                        this.uralpro.log(`Данные распакованы: ${data.length} → ${decompressed.length} символов`, 
                            `style: color: #2e2727; font-weight: bold; background-color: #2196F3; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                    }
                    
                    // Возвращаем строку, а не пытаемся парсить JSON
                    // Это позволяет существующему коду самому решать, как обрабатывать данные
                    return decompressed;
                } catch (error) {
                    this.uralpro.error("Ошибка распаковки данных:", error);
                    return data;
                }
            },

            set: (key, value) => {
                if (this.uralpro.isCalledFromConsole()) {
                    this.uralpro.error("Изменение mapDataSDK из консоли запрещено.");
                    return;
                }
                this.uralpro.mapDataSDK.set(key, value);
            },

            has: (key) => {
                return this.uralpro.mapDataSDK.has(key);
            },

            get: (key) => {
                return this.uralpro.mapDataSDK.get(key);
            },

            log(...args) {
                if (this.config.enableLoggingLib) {
                    console.log(...this._formatArgs(args));
                }
            },
            warn(...args) {
                if (this.config.enableLoggingLib) {
                    console.warn(...this._formatArgs(args));
                }
            },

            error(...args) {
                if (this.config.enableLoggingLib) {
                    console.error(...this._formatArgs(args));
                }
            },

            info(...args) {
                if (this.config.enableLoggingLib) {
                    console.info(...this._formatArgs(args));
                }
            },

            // Вспомогательный метод для обработки стилей
            _formatArgs(args) {
                const formattedArgs = [];
                let styles = [];

                args.forEach(arg => {
                    if (typeof arg === 'string' && arg.startsWith('style:')) {
                        // Если аргумент начинается с "style:", добавляем его как стиль
                        styles.push(arg.replace('style:', ''));
                    } else {
                        // Если это не стиль, добавляем как есть
                        formattedArgs.push(arg);
                    }
                });

                // Если есть стили, добавляем %c к каждому сообщению
                if (styles.length > 0) {
                    const styledArgs = formattedArgs.map(msg => [`%c${msg}`, ...styles]);
                    return styledArgs.flat();
                }

                return formattedArgs;
            },

            isNumber: (value) => {
                return !isNaN(parseFloat(value)) && isFinite(value);
            },

            isNumeric: (str) => {
                return /^-?\d*\.?\d+$/.test(str);
            },

            convertStringToIntIfNumber: (str) => {
                if (str && this.uralpro.isNumeric(str)) {
                    // Проверяем наличие десятичной точки
                    return str.includes('.') ? parseFloat(str) : parseInt(str, 10);
                }
                return str;
            },

            removeNonDigits: (input) => {
              if (input == null) return null;
              
              const str = String(input).trim();
              const isNeg = str.startsWith('-');
              // удаляем всё, кроме цифр и точки
              const cleaned = str.replace(/[^\d.]/g, '');
              
              // оставляем только первую точку
              const parts = cleaned.split('.');
              const normalized = parts.length > 1
                ? parts[0] + '.' + parts.slice(1).join('')
                : parts[0];
              
              return isNeg ? '-' + normalized : normalized;
            },

            getValueByKey: (array, key) => {
                const entry = array.find(item => item[0] === key);
                return entry ? entry[1] : null;
            },

            areMapsEqual: (map1, map2) => {
                if (map1.size !== map2.size) return false;
                for (let [key, value] of map1) {
                    if (!map2.has(key) || map2.get(key) !== value) return false;
                }
                return true;
            },

            isCalledFromConsole: () => {
                try {
                    // Разрешаем вызовы из Android callback'ов
                    if (window._androidCallbackInProgress) return false;
                    
                    if (typeof window.console !== "undefined" && window.console.firebug) return true;
                    const error = new Error();
                    return error.stack.split('\n').some(line =>
                        line.includes('at <anonymous>') ||
                        line.includes('at eval') ||
                        line.includes('chrome-extension://') // Блокировка расширений
                    );
                } catch (e) {
                    return false;
                }
            },

            // Метод инициализации
            init: () => {
                const self = this;

                if (self.uralpro.get('____init')) {
                    return;
                }
                if (self.uralpro.isCalledFromConsole()) {
                    self.uralpro.error("Запуск из консоли запрещено.");
                    return;
                }
                self.uralpro.set('____init', true);

                self.uralpro.set('getPlayer', "");
                self.uralpro.set('sdk', null);

                self.uralpro.set('isSdkReadyStop', "START");
                self.uralpro.set('isSdkReady', false);
                self.uralpro.set('isSdkReadyData', false);

                self.uralpro.set('isLoaded', false);
                self.uralpro.set('isGameReady', false);

                self.uralpro.set('mapDataYandexApp', new Map());
                self.uralpro.set('mapDataApp', new Map());
                self.uralpro.set('saveDataOld1', new Map());
                self.uralpro.set('saveDataOld2', new Map());

                if (self.uralpro.config.disableLoggingHtml) {
                    console.log = function() {};
                    console.warn = function() {};
                    console.error = function() {};
                    console.info = function() {};
                }

                // Определение платформы
                const protocol = window.location.protocol;
                const href = window.location.href;

                if (protocol === "file:") {
                    self.uralpro.set('platform', "file");
                } else if (href.includes("yandex")) {
                    self.uralpro.set('platform', "yandex");
                } else if (href.includes("poki.com") || href.includes("poki")) {
                    self.uralpro.set('platform', "poki");
                } else {
                    self.uralpro.set('platform', "unknown");
                }

                // Работаем с url для получаения платформы
                function getParam(name) {
                    const match = new RegExp(`[?&]${name}=([^&]*)`).exec(window.location.search);
                    return match ? decodeURIComponent(match[1]) : null;
                }
                
                const platform_url = getParam('uralpro-platform');

                if (platform_url && platform_url != "") {
                    if (platform_url == "vk") {
                        self.uralpro.set('platform', "vk");
                    }
                    if (platform_url == "poki") {
                        self.uralpro.set('platform', "poki");
                    }
                    if (protocol === "file:" && platform_url == "android") {
                        self.uralpro.set('platform', "android");
                    }
                }

                self.uralpro.log(`Определена платформа: ${self.uralpro.get('platform')}`, `style: color: green; font-weight: bold; background-color: black; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);

                function loadStartData() {
                    // Сначала обнаруживаем все сохраненные настройки
                    self.discoverSavedSettings();
                    
                    // Затем загружаем все настройки (включая обнаруженные) из save_idArray
                    for (let i = 0; i < self.uralpro.save_idArray.length; i++) {
                        const idname = self.uralpro.save_id000 + self.uralpro.save_idArray[i][0];

                        let value = self.uralpro.save_idArray[i][1];
                        if (Array.isArray(value)) {
                            self.uralpro.save_idArray[i][1] = JSON.stringify(value);
                        }

                        if (self.uralpro.get("getPlayer") === "yandex") {
                            // Яндекс
                            if (self.uralpro.get('mapDataYandexApp').has(idname)) {
                                let dataN = self.uralpro.get('mapDataYandexApp').get(idname);
                                if (self.uralpro.isNumber(self.uralpro.save_idArray[i][1])) {
                                    dataN = self.uralpro.removeNonDigits(dataN);
                                }
                                // Распаковываем данные при загрузке, если они сжаты
                                if (typeof dataN === 'string' && dataN.startsWith('COMPRESSED:')) {
                                    // Данные сжаты, распаковываем независимо от настроек
                                    const decompressed = self.uralpro.decompressData(dataN);
                                    const parsedData = self.safeJsonParse(decompressed);
                                    self.uralpro.get('mapDataApp').set(idname, parsedData);
                                } else {
                                    // Данные не сжаты, сохраняем как есть
                                    self.uralpro.get('mapDataApp').set(idname, self.uralpro.convertStringToIntIfNumber(dataN));
                                }
                            } else {
                                self.uralpro.get('mapDataApp').set(idname, self.uralpro.save_idArray[i][1]);
                            }
                        } else {
                            // Локальное хранилище
                            if (localStorage.getItem(idname)) {
                                let dataN = localStorage.getItem(idname);
                                if (self.uralpro.isNumber(self.uralpro.save_idArray[i][1])) {
                                    // dataN = self.uralpro.removeNonDigits(dataN);
                                }
                                // Распаковываем данные при загрузке, если они сжаты
                                if (typeof dataN === 'string' && dataN.startsWith('COMPRESSED:')) {
                                    // Данные сжаты, распаковываем независимо от настроек
                                    const decompressed = self.uralpro.decompressData(dataN);
                                    const parsedData = self.safeJsonParse(decompressed);
                                    self.uralpro.get('mapDataApp').set(idname, parsedData);
                                } else {
                                    // Данные не сжаты, сохраняем как есть
                                    self.uralpro.get('mapDataApp').set(idname, self.uralpro.convertStringToIntIfNumber(dataN));
                                }
                            } else {
                                localStorage.setItem(idname, self.uralpro.save_idArray[i][1]);
                                self.uralpro.get('mapDataApp').set(idname, self.uralpro.save_idArray[i][1]);
                            }
                        }
                    }


                    this.setData("UH-Platform", this.platform);

                    if(!this.hasData("UH-UUID")){
                        this.setData("UH-UUID", this.js.generateUUID());
                    }
                    if(!this.hasData("UH-FirstLaunch")){
                        this.setData("UH-FirstLaunch", new Date().toISOString());
                    }
                    if(!this.hasData("UH-NumberOfStarts")){
                        this.setData("UH-NumberOfStarts", 1);
                    }else{
                        this.setData("UH-NumberOfStarts", Number(this.getData("UH-NumberOfStarts", 1)) + 1);
                    }

                }

                async function getPlayerData() {
                    if (!self.uralpro.get('sdk')) {
                        throw new Error("Yandex SDK не инициализирован.");
                    }

                    try {
                        // Получение объекта игрока
                        const _player = await self.uralpro.get('sdk').getPlayer();
                        if (!_player) {
                            throw new Error("Не удалось получить объект игрока.");
                        }

                        self.uralpro.set('getPlayer', "yandex");
                        self.uralpro.set('_player', _player);

                        // Попытки загрузки данных
                        let attempts = 3;
                        let dataLoaded = false;
                        while (attempts > 0 && !dataLoaded) {
                            try {
                                const dataYA = await _player.getData();
                                if (dataYA && dataYA.data) {
                                    const data = dataYA.data;
                                    for (const entry of data) {
                                        self.uralpro.get('mapDataYandexApp').set(entry[0], entry[1]);
                                    }
                                    dataLoaded = true;
                                } else {
                                    self.uralpro.warn("Данные игрока отсутствуют или не были получены.");
                                    dataLoaded = true;
                                }
                            } catch (error) {
                                self.uralpro.error(`Ошибка при получении данных игрока. Попыток осталось: ${attempts - 1}`, error);
                                attempts--;
                                await new Promise(res => setTimeout(res, 2000));
                            }
                        }

                        if (!dataLoaded) {
                            self.uralpro.error("Не удалось загрузить данные игрока. Проверьте подключение к интернету.");
                            self.uralpro.set('isSdkReadyStop', "STOP");
                        }

                        // Выполняем загрузку стартовых данных в любом случае
                        loadStartData.bind(self)();

                        self.uralpro.set('setup_saveData', 1);
                        self.saveData();
                        setInterval(self.saveData, 1000 * 60);

                        if (dataLoaded) {
                            self.uralpro.set('isSdkReadyData', true);
                            self.uralpro.set('isSdkReadyStop', "START");
                        }

                    } catch (error) {
                        self.uralpro.set('isSdkReadyStop', "STOP");
                        self.uralpro.error("Ошибка initPlayer:", error);
                        setTimeout(() => getPlayerData.bind(self)(), 1000);
                    }
                }

                async function setupSafeStorage() {
                    if (!self.uralpro.get('sdk')) throw new Error("Yandex SDK не инициализирован.");

                    try {
                        const safeStorage = await self.uralpro.get('sdk').getStorage();
                        Object.defineProperty(window, "localStorage", {
                            get: () => safeStorage,
                        });
                        self.uralpro.log("Безопасное хранилище настроено.");
                    } catch (error) {
                        self.uralpro.error("Ошибка настройки безопасного хранилища:", error);
                    }
                }

                function setupLocalEnvironment() {
                    const urlLang = new URLSearchParams(window.location.search).get("lang");
                    const defaultLang = window.navigator.language.slice(0, 2);
                    self.uralpro.set('lang', urlLang || defaultLang);

                    loadStartData.bind(self)();
                    self.uralpro.set('isSdkReady', true);
                    self.uralpro.set('isSdkReadyData', true);

                    self.uralpro.set('setup_saveData', 1);
                    self.saveData();
                    setInterval(self.saveData, 1000 * 60);
                }

                async function setupYandexSDK() {
                    try {
                        self.uralpro.set('sdk', await YaGames.init());
                        self.uralpro.log("Yandex SDK успешно инициализирован.");
                        self.uralpro.set('isSdkReady', true);

                        await setupSafeStorage.bind(self)();
                        await getPlayerData.bind(self)();

                        self.uralpro.get('sdk').features.GamesAPI.getAllGames()
                            .then(({
                                games,
                                developerURL
                            }) => {
                                self.uralpro.set('yandex_getAllGames', [games, developerURL]);
                            })
                            .catch(err => {
                                self.uralpro.error("Ошибка получения списка игр:", err);
                            });

                        const yandexDomenLangYa = self.uralpro.get('sdk').environment.i18n.lang;

                        const languageURL1 = new URL(document.location).searchParams.get("lang");
                        const browserLangFirstTwo = window.navigator.language.substring(0, 2);

                        self.uralpro.set('lang', yandexDomenLangYa || languageURL1 || browserLangFirstTwo);

                        self.uralpro.log("Yandex SDK настроен.");

                        self.lb.initializeLeaderboard();
                        
                        try {
                            const result = await self.uralpro.get('sdk').feedback.canReview();
                            self.uralpro.set('yandex_canReview', result.value);
                        } catch (error) {
                            self.uralpro.error("Ошибка checkCanreview:", error);
                            self.uralpro.set('yandex_canReview', false);
                        }

                        try {
                            const result = await self.uralpro.get('sdk').getFlags();
                            self.uralpro.set('yandex_flags', result);
                        } catch (error) {
                            self.uralpro.error("Ошибка flags:", error);
                            self.uralpro.set('yandex_flags', false);
                        }

                        try {
                            const prompt = await self.uralpro.get('sdk').shortcut.canShowPrompt();
                            self.uralpro.set('shortcut_available', prompt.canShow);
                        } catch (error) {
                            self.uralpro.error("Ошибка проверки возможности добавления ярлыка:", error);
                            self.uralpro.set('shortcut_available', false);
                        }

                        //покупки
                        self.uralpro.get('sdk').getPayments({
                            signed: false
                        }).then(payments => {
                            payments.getPurchases().then(purchases => {
                                self.uralpro.set("yaPayments", payments);
                            });
                            payments.getCatalog().then(products => {
                                self.uralpro.set("yandex_products", products);
                                self.uralpro.set("yandex_productsIconSVG", products[0].getPriceCurrencyImage("svg"));
                                self.uralpro.set("yandex_productsNameV", products[0].priceCurrencyCode);
                            });

                        }).catch(err => {
                            self.uralpro.error("Ошибка getPayments:", err);
                        });

                    } catch (error) {
                        self.uralpro.error("Ошибка инициализации Yandex SDK:", error);
                        setTimeout(() => setupYandexSDK.bind(self)(), 1000);
                    }
                }
                
                async function setupAndroidSDK() {
                    setupLocalEnvironment.bind(self)();

                    // ключи покупок
                    const purchaseKeys = self.uralpro.config.purchaseFunctionList.map(item => item.key);
                    console.log("TT Purchase keys:", purchaseKeys);

                    // Инициализируем массив продуктов
                    const androidProducts = [];
                    self.uralpro.set("android_products", androidProducts);

                    // Создаем глобальные callback функции
                    window.onProductPriceReceived = function(price, productId) {
                        window._androidCallbackInProgress = true;
                        try {
                            console.log(`💰 Price for ${productId}: ${price}`);
                            
                            // Получаем текущий массив продуктов
                            const products = self.uralpro.get("android_products") || [];
                            
                            // Проверяем, есть ли уже этот продукт в списке
                            const existingProductIndex = products.findIndex(p => p.id === productId);
                            
                            // Получаем информацию о продукте из purchaseFunctionList
                            const purchaseInfo = self.uralpro.config.purchaseFunctionList.find(item => item.key === productId);
                            
                            const productData = {
                                id: productId,
                                price: price,
                                action: purchaseInfo?.action
                            };
                            
                            if (existingProductIndex !== -1) {
                                // Обновляем цену существующего продукта
                                products[existingProductIndex] = productData;
                            } else {
                                // Добавляем новый продукт
                                products.push(productData);
                            }
                            
                            // Сохраняем обновленный массив
                            self.uralpro.set("android_products", products);
                            console.log(`✅ Product ${productId} добавлен/обновлен. Всего продуктов: ${products.length}`);
                            console.log('📦 Текущий список продуктов:', products);
                        } finally {
                            window._androidCallbackInProgress = false;
                        }
                    };

                    window.onProductPriceError = function(error, productId) {
                        window._androidCallbackInProgress = true;
                        try {
                            console.error(`❌ Error getting price for ${productId}: ${error}`);
                            
                            // Даже при ошибке добавляем продукт с пометкой N/A
                            const products = self.uralpro.get("android_products") || [];
                            const existingProductIndex = products.findIndex(p => p.id === productId);
                            
                            if (existingProductIndex === -1) {
                                // Получаем информацию о продукте из purchaseFunctionList
                                const purchaseInfo = self.uralpro.config.purchaseFunctionList.find(item => item.key === productId);
                                
                                products.push({
                                    id: productId,
                                    price: 'N/A',
                                    error: error,
                                    action: purchaseInfo?.action
                                });
                                self.uralpro.set("android_products", products);
                                console.log(`⚠️ Product ${productId} добавлен с ошибкой. Всего продуктов: ${products.length}`);
                            }
                        } finally {
                            window._androidCallbackInProgress = false;
                        }
                    };

                    // Обработчик успешной покупки
                    window.onPurchaseSuccess = function(purchaseId, productId) {
                        // Устанавливаем флаг, чтобы обойти защиту isCalledFromConsole
                        window._androidCallbackInProgress = true;
                        
                        try {
                            console.log(`✅ Покупка успешна для товара ${productId}, ID покупки: ${purchaseId}`);
                            
                            // Находим обработчик покупки из purchaseFunctionList
                            const purchaseInfo = self.uralpro.config.purchaseFunctionList.find(item => item.key === productId);
                            
                            if (purchaseInfo && typeof purchaseInfo.action === 'function') {
                                // Вызываем action для обработки покупки (добавление монет)
                                purchaseInfo.action({
                                    productId: productId,
                                    purchaseId: purchaseId
                                });
                                console.log(`🎉 Action выполнен для продукта ${productId}`);
                                
                                // Вызываем callback если он был сохранен
                                if (window._androidPurchaseCallbacks && window._androidPurchaseCallbacks[productId]) {
                                    const { endFun } = window._androidPurchaseCallbacks[productId];
                                    if (typeof endFun === 'function') {
                                        endFun();
                                    }
                                    // Удаляем callback после использования
                                    delete window._androidPurchaseCallbacks[productId];
                                }
                            } else {
                                console.error(`⚠️ Action не найден для продукта ${productId}`);
                            }
                        } finally {
                            // Всегда снимаем флаг после выполнения
                            window._androidCallbackInProgress = false;
                        }
                    };

                    // Обработчик ошибки покупки
                    window.onPurchaseError = function(errorMessage, productId) {
                        window._androidCallbackInProgress = true;
                        try {
                            console.error(`❌ Ошибка покупки товара ${productId}: ${errorMessage}`);
                            
                            // Вызываем error callback если он был сохранен
                            if (window._androidPurchaseCallbacks && window._androidPurchaseCallbacks[productId]) {
                                const { errorFun } = window._androidPurchaseCallbacks[productId];
                                if (typeof errorFun === 'function') {
                                    errorFun(errorMessage);
                                }
                                // Удаляем callback после использования
                                delete window._androidPurchaseCallbacks[productId];
                            }
                        } finally {
                            window._androidCallbackInProgress = false;
                        }
                    };

                    // Запрашиваем цены для каждого продукта
                    purchaseKeys.forEach(productId => {
                        if (typeof AndroidFunction !== 'undefined' && AndroidFunction.getProductPrice) {
                            AndroidFunction.getProductPrice(productId);
                            self.uralpro.log("[Purchase] AndroidFunction.getProductPrice доступна " + productId);
                        } else {
                            self.uralpro.error("[Purchase] AndroidFunction.getProductPrice недоступна");
                        }
                    });
                }

                async function setupPokiSDK() {
                    try {
                        // Проверяем наличие PokiSDK
                        if (typeof PokiSDK === 'undefined') {
                            self.uralpro.error("PokiSDK не найден. Убедитесь, что скрипт загружен.");
                            setupLocalEnvironment.bind(self)();
                            return;
                        }

                        // Инициализируем Poki SDK
                        await PokiSDK.init();
                        self.uralpro.set('sdk', PokiSDK);
                        self.uralpro.log("Poki SDK успешно инициализирован.");
                        self.uralpro.set('isSdkReady', true);

                        // Устанавливаем язык
                        const languageURL1 = new URL(document.location).searchParams.get("lang");
                        const browserLangFirstTwo = window.navigator.language.substring(0, 2);
                        self.uralpro.set('lang', languageURL1 || browserLangFirstTwo);

                        // Настраиваем локальное окружение для Poki
                        loadStartData.bind(self)();
                        self.uralpro.set('isSdkReadyData', true);

                        self.uralpro.set('setup_saveData', 1);
                        self.saveData();
                        setInterval(self.saveData, 1000 * 60);

                        self.uralpro.log("Poki SDK настроен.");

                    } catch (error) {
                        self.uralpro.error("Ошибка инициализации Poki SDK:", error);
                        // Продолжаем работу без SDK
                        setupLocalEnvironment.bind(self)();
                    }
                }

                // Загрузка SDK в зависимости от платформы
                switch (self.uralpro.get('platform')) {
                    case "file":
                        setupLocalEnvironment.bind(self)();
                        break;
                    case "yandex":
                        self.scriptManager.loadJS("/sdk.js", () => setupYandexSDK.bind(self)());
                        break;
                    case "poki":
                        // Poki SDK должен быть загружен через script tag в HTML
                        // Если SDK уже загружен, инициализируем сразу
                        if (typeof PokiSDK !== 'undefined') {
                            setupPokiSDK.bind(self)();
                        } else {
                            // Если SDK еще не загружен, пытаемся загрузить
                            self.scriptManager.loadJS("https://game-cdn.poki.com/scripts/v2/poki-sdk.js", () => setupPokiSDK.bind(self)());
                        }
                        break;
                    case "vk":
                        setupLocalEnvironment.bind(self)();
                        if (self.vkApi && typeof self.vkApi.showAuthAlert === 'function') {
                            setTimeout(() => self.vkApi.showAuthAlert(), 0);
                        }
                        break;
                    case "android":
                        setupAndroidSDK.bind(self)();
                        break;
                    default:
                        setupLocalEnvironment.bind(self)();
                        break;
                }

                //fps панель
                if (self.uralpro.config.panelFPS) {
                    (function() {
                        let fpsPanel = document.createElement('div');
                        fpsPanel.id = 'fps-panel';
                        document.body.appendChild(fpsPanel);

                        Object.assign(fpsPanel.style, {
                            position: 'fixed',
                            top: '10px',
                            right: '10px',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            color: 'lime',
                            padding: '5px 10px',
                            borderRadius: '5px',
                            fontFamily: 'Arial, sans-serif',
                            fontSize: '14px',
                            zIndex: '9001',
                            pointerEvents: 'none',
                            whiteSpace: 'pre-wrap'
                        });

                        let lastTime = performance.now(),
                            frameCount = 0,
                            fps = 0,
                            minFps = Infinity,
                            maxFps = 0,
                            frameTimes = [];

                        function updateFPS() {
                            let now = performance.now();
                            let deltaTime = now - lastTime;
                            frameTimes.push(deltaTime);
                            frameCount++;

                            if (now - lastTime >= 1000) {
                                fps = frameCount;
                                frameCount = 0;
                                lastTime = now;
                                minFps = Math.min(minFps, fps);
                                maxFps = Math.max(maxFps, fps);
                                let avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
                                frameTimes = [];
                                fpsPanel.textContent = `FPS: ${fps}\nМин: ${minFps} Макс: ${maxFps}\nСреднее время кадра: ${avgFrameTime.toFixed(2)}ms`;
                            }
                            requestAnimationFrame(updateFPS);
                        }

                        function changePosition() {
                            let positions = [{
                                    top: '10px',
                                    right: '10px',
                                    bottom: 'auto',
                                    left: 'auto'
                                },
                                {
                                    top: '10px',
                                    right: 'auto',
                                    bottom: 'auto',
                                    left: '10px'
                                },
                                {
                                    top: 'auto',
                                    right: '10px',
                                    bottom: '10px',
                                    left: 'auto'
                                },
                                {
                                    top: 'auto',
                                    right: 'auto',
                                    bottom: '10px',
                                    left: '10px'
                                }
                            ];
                            let index = 0;
                            setInterval(() => {
                                Object.assign(fpsPanel.style, positions[index]);
                                index = (index + 1) % positions.length;
                            }, 10000);
                        }

                        updateFPS();
                        changePosition();
                    })();
                }
                //панель для отображения ошибок
                if (self.uralpro.config.errorTracking) {
                    try {
                        let errorShown = false;

                        function handleError(event, isPromiseRejection = false) {
                            if (errorShown) return;
                            errorShown = true;

                            // Формирование сообщения об ошибке
                            let errorMessage = isPromiseRejection ?
                                `🚨 [Promise] ${event.reason}` :
                                `🚨 Ошибка: ${event.message || "Script Error"}\n📄 Файл: ${event.filename || "Неизвестно"}\n📌 Строка: ${event.lineno || "?"}, Колонка: ${event.colno || "?"}`;

                            if (event.error) {
                                errorMessage += `\n🔍 Тип: ${event.error.name || "Неизвестно"}\n📜 Сообщение: ${event.error.message || "Неизвестно"}`;
                                if (event.error.stack) {
                                    errorMessage += `\n📌 Стек:\n${event.error.stack.split('\n').join('\n')}`;
                                }

                                // Проверка, запущен ли код в WebView
                                let isWebView = /WebView|wv|Chrome\/[.0-9]* Mobile/.test(navigator.userAgent);
                                errorMessage += `\n\n📱 WebView: ${isWebView ? "Да" : "Нет"}`;
                                errorMessage += `\n\n🌐 User Agent: ${navigator.userAgent}`;
                                errorMessage += `\n📡 Location: ${window.location.href}`;
                                errorMessage += `\n📋 Cookies: ${document.cookie}`;

                                // Создаем или находим окно для отображения ошибки
                                let errorBox = document.getElementById('error-box');
                                if (!errorBox) {
                                    errorBox = document.createElement('div');
                                    errorBox.id = 'error-box';
                                    Object.assign(errorBox.style, {
                                        position: 'fixed',
                                        top: '10px',
                                        left: '10px',
                                        right: '10px',
                                        zIndex: '10000',
                                        backgroundColor: 'rgba(255, 0, 0, 0.9)',
                                        color: 'white',
                                        padding: '15px',
                                        borderRadius: '5px',
                                        fontFamily: 'Arial, sans-serif',
                                        fontSize: '14px',
                                        whiteSpace: 'pre-wrap',
                                        boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                                        maxHeight: '300px',
                                        overflow: 'auto',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px',
                                        overflowWrap: 'break-word'
                                    });
                                    document.body.appendChild(errorBox);
                                }

                                // Контейнер для кнопок
                                let buttonsContainer = document.createElement('div');
                                Object.assign(buttonsContainer.style, {
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: '10px',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
                                    paddingBottom: '10px',
                                    marginBottom: '10px'
                                });

                                // Кнопка "Копировать"
                                let copyButton = document.createElement('button');
                                copyButton.textContent = '📋 Копировать';
                                Object.assign(copyButton.style, {
                                    cursor: 'pointer',
                                    background: 'white',
                                    color: 'black',
                                    border: 'none',
                                    padding: '5px 10px',
                                    borderRadius: '3px'
                                });

                                function fallbackCopyTextToClipboard(text) {
                                    const textArea = document.createElement('textarea');
                                    textArea.value = text;
                                    textArea.style.position = 'fixed';
                                    textArea.style.top = '0';
                                    textArea.style.left = '0';
                                    textArea.style.width = '2em';
                                    textArea.style.height = '2em';
                                    textArea.style.padding = '0';
                                    textArea.style.border = 'none';
                                    textArea.style.outline = 'none';
                                    textArea.style.boxShadow = 'none';
                                    textArea.style.background = 'transparent';
                                    document.body.appendChild(textArea);
                                    textArea.focus();
                                    textArea.select();

                                    try {
                                        let successful = document.execCommand('copy');
                                        if (successful) {
                                            alert('Сообщение об ошибке скопировано в буфер обмена');
                                        } else {
                                            alert('Не удалось скопировать сообщение об ошибке');
                                        }
                                    } catch (err) {
                                        alert('Ошибка при копировании: ' + err);
                                    }

                                    document.body.removeChild(textArea);
                                }

                                copyButton.onclick = () => {
                                    const errorMessage_n = errorMessage; // Замените на ваше сообщение об ошибке

                                    if (self.uralpro.get('sdk') && self.uralpro.get('platform') === "yandex") {
                                        self.uralpro.get('sdk').clipboard.writeText(errorMessage_n).then(() => {
                                            alert('Сообщение об ошибке скопировано в буфер обмена');
                                        }).catch(err => {
                                            self.uralpro.error("Ошибка копирования в буфер обмена:", err);
                                        });
                                    } else {
                                        // Попробуем использовать Clipboard API
                                        if (navigator.clipboard) {
                                            navigator.clipboard.writeText(errorMessage_n).then(() => {
                                                alert('Сообщение об ошибке скопировано в буфер обмена');
                                            }).catch((err) => {
                                                self.uralpro.error('Не удалось скопировать сообщение об ошибке: ', err);
                                                // Если Clipboard API недоступен, используем альтернативный метод
                                                fallbackCopyTextToClipboard(errorMessage_n);
                                            });
                                        } else {
                                            // Если Clipboard API не поддерживается, используем альтернативный метод
                                            fallbackCopyTextToClipboard(errorMessage_n);
                                        }
                                    }
                                };

                                // Кнопка "Закрыть"
                                let closeButton = document.createElement('button');
                                closeButton.textContent = '✖ Закрыть';
                                Object.assign(closeButton.style, {
                                    cursor: 'pointer',
                                    background: 'white',
                                    color: 'black',
                                    border: 'none',
                                    padding: '5px 10px',
                                    borderRadius: '3px'
                                });
                                closeButton.onclick = () => {
                                    errorBox.remove();
                                    errorShown = false;
                                };

                                buttonsContainer.appendChild(copyButton);
                                buttonsContainer.appendChild(closeButton);

                                // Добавляем кнопки в начало окна ошибки
                                errorBox.appendChild(buttonsContainer);
                                errorBox.append(errorMessage);

                                self.uralpro.error(errorMessage);
                            }
                        }

                        // Глобальный обработчик ошибок
                        window.onerror = function(message, source, lineno, colno, error) {
                            handleError({
                                message: message,
                                filename: source,
                                lineno: lineno,
                                colno: colno,
                                error: error
                            });
                            return false;
                        };

                        // Обработчик неперехваченных промисов
                        window.addEventListener('unhandledrejection', function(event) {
                            if (self.uralpro && self.uralpro.log) {
                                self.uralpro.log('Promise Rejection:', event.reason);
                            } else {
                                console.error('uralpro.log не доступен:', event.reason);
                            }
                            handleError(event, true);
                        });

                    } catch (e) {
                        self.uralpro.error('Ошибка в обработчике ошибок:', e);
                    }
                }
            }
        };

        this.scriptManager = {
            appendScript: (src, async, onload) => {
                if (this.uralpro.isCalledFromConsole()) {
                    this.uralpro.error("Запуск из консоли запрещено.");
                    return;
                }
                let script = document.createElement('script');
                script.src = src;
                script.async = async;
                if (onload) script.onload = onload;
                document.head.appendChild(script);
            },
            loadScript: (src) => {
                if (this.uralpro.isCalledFromConsole()) {
                    this.uralpro.error("Запуск из консоли запрещено.");
                    return;
                }
                this.scriptManager.appendScript(src, false);
            },
            loadScripts: (scripts) => {
                if (this.uralpro.isCalledFromConsole()) {
                    this.uralpro.error("Запуск из консоли запрещено.");
                    return;
                }
                scripts.forEach(src => this.scriptManager.loadScript(src));
            },
            // Универсальный метод загрузки SDK
            loadJS: (sdkUrl, onLoadCallback) => {
                if (this.uralpro.isCalledFromConsole()) {
                    this.uralpro.error("Запуск из консоли запрещено.");
                    return;
                }

                this.uralpro.log(`Загрузка "${sdkUrl}"`, `style: color: #2e2727; font-weight: bold; background-color: #b49a11; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                const script = document.createElement("script");
                script.src = sdkUrl;
                script.async = true;

                script.onload = () => {
                    this.uralpro.log(`"${sdkUrl}" успешно загружен`, `style: color: green; font-weight: bold; background-color: #b49a11; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                    this.uralpro.set('isLoaded', true);
                    if (typeof onLoadCallback === "function") onLoadCallback();
                };

                script.onerror = () => this.uralpro.error(`Ошибка загрузки "${sdkUrl}"`, `style: color: red; font-weight: bold; background-color: #b49a11; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                document.head.appendChild(script);
            }
        };

        this.lb = {
            availability: false,
            initializeLeaderboard: async () => {
                try {
					const leaderboards = this.uralpro.get('sdk').leaderboards;
                    this.uralpro.set("lb_sdk", leaderboards);
                    const available = await this.uralpro.get('sdk').isAvailableMethod('leaderboards.setScore');
                    this.lb.availability = available;
                } catch (error) {
                    this.uralpro.error(`Ошибка при инициализации работы лидербордов:`, error);
                }
            },

            setLeaderboardScore: async (leaderboardName, score, extraData = null) => {
                if (this.uralpro.isCalledFromConsole()) {
                    this.uralpro.error("Изменение лидерборда из консоли запрещено.");
                    return;
                }

                if (typeof score !== "number") {
                    this.uralpro.error(`Переданный результат "${score}" не является числом.`);
                    return;
                }

                try {
                    if (!this.lb.availability) {
                        this.uralpro.log("Метод установки результата недоступен.");
                        return;
                    }

                    // Если extraData является объектом, преобразуем его в JSON-строку
                    let dataToSend = extraData;
                    if (dataToSend && typeof dataToSend === "object") {
                        dataToSend = JSON.stringify(dataToSend);
                    }
                    if (dataToSend) {
                        this.uralpro.log("setLeaderboardScore.dataToSend", dataToSend);  
                    }

                    const sdk_leaderboard = this.uralpro.get("lb_sdk");

                    if (!sdk_leaderboard) {
                        this.uralpro.error("Ошибка загрузки sdk[лидерборд].");
                        return null;
                    }

                    if (dataToSend && dataToSend != "") {
                        await sdk_leaderboard.setScore(leaderboardName, score, dataToSend);
                    } else {
                        await sdk_leaderboard.setScore(leaderboardName, score);
                    }

                    this.uralpro.log("Результат успешно отправлен в лидерборд.");
                } catch (error) {
                    this.uralpro.error("Ошибка при отправке результата:", error);
                }
            },
            //Записи лидерборда
            getLeaderboardEntries: async (leaderboardName, options = {}) => {
                if ((!leaderboardName || leaderboardName.length == 0) && typeof leaderboard != "string") {
                    this.uralpro.error("Лидерборд не допустим.");
                    return [];
                }

                    const sdk_leaderboard = this.uralpro.get("lb_sdk");

                    if (!sdk_leaderboard) {
                        this.uralpro.error("Ошибка загрузки sdk[лидерборд].");
                        return null;
                    }

                try {
                    const res = await sdk_leaderboard.getEntries(leaderboardName, options);
                    if (!res || !res.entries.length) {
                        this.uralpro.warn(`Записи лидерборда "${leaderboardName}" отсутствуют.`);
                        return [];
                    }

                    // Получаем ID текущего пользователя
                    const currentUserId = (await this.uralpro.get('sdk').getPlayer()).getUniqueID();

                    // Формируем массив и добавляем флаг isCurrentUser
                    const entries = res.entries.map(entry => ({
                        rank: entry.rank,
                        name: entry.player.publicName || 'Пользователь скрыт',
                        score: entry.score,
                        avatar: entry.player.getAvatarSrc('medium'),
                        isCurrentUser: entry.player.uniqueID === currentUserId
                    }));

                    this.uralpro.set("getLeaderboardEntries_Data_" + leaderboardName, entries);
                    return entries;
                } catch (err) {
                    this.uralpro.error("Ошибка при получении записей лидерборда:", err);
                    return this.uralpro.get("getLeaderboardEntries_Data_" + leaderboardName) || [];
                }
            },

            //Описание лидерборда
            getLeaderboardDescription: async (leaderboardName) => {
                if (!leaderboardName || leaderboardName.length == 0) {
                    this.uralpro.error("Лидерборд не допустим.");
                    return null;
                }

                    const sdk_leaderboard = this.uralpro.get("lb_sdk");

                    if (!sdk_leaderboard) {
                        this.uralpro.error("Ошибка загрузки sdk[лидерборд].");
                        return null;
                    }

                try {
                    const description = await sdk_leaderboard.getDescription(leaderboardName);
                    if (!description || !Object.keys(description).length) {
                        this.uralpro.warn(`Описание лидерборда "${leaderboardName}" отсутствует.`);
                        return null;
                    }

                    this.uralpro.set("getLeaderboardDescription_Data", description);
                    this.uralpro.log(`Описание лидерборда "${leaderboardName}" успешно получено.`);
                    return description;
                } catch (error) {
                    this.uralpro.error(`Ошибка при получении описания лидерборда "${leaderboardName}":`, error);
                    return this.uralpro.get("getLeaderboardDescription_Data") || null;
                }
            }
        };

        this.ad = {
            showFullscreenAdv: async (additionalOnOpen, additionalOnClose, additionalOnError) => {
                const now = Date.now();
                const lastShown = Number(localStorage.getItem("ysdk_lastFullscreenAdv") || 0);
                const cooldown = 61 * 1000;
            
                // Проверяем кулдаун независимо от платформы
                if (now - lastShown < cooldown) {
                    const waitTime = Math.ceil((cooldown - (now - lastShown)) / 1000);
                    this.uralpro.warn(`Реклама была показана недавно. Подождите ещё ${waitTime} секунд.`);
                    additionalOnError?.();
                    return;
                }
            
                // Если доступен AndroidFunction, используем его
                if (typeof AndroidFunction !== "undefined") {
                    try {
                        // Сохраняем время показа рекламы
                        localStorage.setItem("ysdk_lastFullscreenAdv", Date.now());
                        
                        // Вызываем колбэк открытия
                        this.uralpro.log("Полноэкранная реклама открыта (Android).");
                        this.uralpro.set("ysdkAdvStart", "1");
                        additionalOnOpen?.();
                        
                        // Показываем рекламу через Android
                        AndroidFunction.showInterstitialAd();
                        
                        // Эмулируем закрытие рекламы через некоторое время
                        // (это приблизительная реализация, так как мы не знаем точное время показа рекламы на Android)
                        setTimeout(() => {
                            this.uralpro.log("Полноэкранная реклама закрыта (Android).");
                            this.uralpro.set("ysdkAdvStart", "0");
                            additionalOnClose?.();
                        }, 5000); // Предполагаем, что реклама показывается 5 секунд
                        
                    } catch (error) {
                        this.uralpro.error("Ошибка показа полноэкранной рекламы через Android:", error);
                        this.uralpro.set("ysdkAdvStart", "0");
                        additionalOnError?.(error);
                    }
                    return;
                }
            
                // Проверяем платформу Poki
                if (this.uralpro.get('platform') === "poki" && this.uralpro.get('isSdkReady') && this.uralpro.get('sdk')) {
                    try {
                        this.uralpro.log("Показ полноэкранной рекламы Poki (commercialBreak).");
                        this.uralpro.set("ysdkAdvStart", "1");
                        localStorage.setItem("ysdk_lastFullscreenAdv", Date.now());
                        additionalOnOpen?.();
                        
                        // Poki SDK использует commercialBreak для полноэкранной рекламы
                        if (typeof this.uralpro.get('sdk').commercialBreak === 'function') {
                            await this.uralpro.get('sdk').commercialBreak();
                        }
                        
                        this.uralpro.log("Полноэкранная реклама Poki закрыта.");
                        this.uralpro.set("ysdkAdvStart", "0");
                        additionalOnClose?.();
                    } catch (error) {
                        this.uralpro.error("Ошибка показа полноэкранной рекламы Poki:", error);
                        this.uralpro.set("ysdkAdvStart", "0");
                        additionalOnError?.(error);
                    }
                    return;
                }
            
                // Если AndroidFunction не доступен, используем Yandex SDK
                if (!this.uralpro.get('isSdkReady') || !this.uralpro.get('sdk')?.adv) {
                    this.uralpro.warn("Реклама недоступна.");
                    additionalOnError?.(this.uralpro.get('platform'));
                    return;
                }
            
                try {
                    await this.uralpro.get('sdk').adv.showFullscreenAdv({
                        callbacks: {
                            onOpen: () => {
                                this.uralpro.log("Полноэкранная реклама открыта.");
                                this.uralpro.set("ysdkAdvStart", "1");
                                localStorage.setItem("ysdk_lastFullscreenAdv", Date.now());
                                additionalOnOpen?.();
                            },
                            onClose: () => {
                                this.uralpro.log("Полноэкранная реклама закрыта.");
                                this.uralpro.set("ysdkAdvStart", "0");
                                additionalOnClose?.();
                            },
                            onError: (error) => {
                                this.uralpro.error("Ошибка показа полноэкранной рекламы:", error);
                                this.uralpro.set("ysdkAdvStart", "0");
                                additionalOnError?.(error);
                            }
                        }
                    });
                } catch (error) {
                    this.uralpro.error("Ошибка при вызове полноэкранной рекламы:", error);
                }
            },
            showRewardedVideo: async (additionalOnOpen, additionalOnRewarded, additionalOnClose, additionalOnError) => {
                // Проверяем платформу Poki
                if (this.uralpro.get('platform') === "poki" && this.uralpro.get('isSdkReady') && this.uralpro.get('sdk')) {
                    try {
                        this.uralpro.log("Показ вознаграждаемой рекламы Poki (rewardedBreak).");
                        this.uralpro.set("ysdkAdvStart", "1");
                        additionalOnOpen?.();
                        
                        // Poki SDK использует rewardedBreak для вознаграждаемой рекламы
                        if (typeof this.uralpro.get('sdk').rewardedBreak === 'function') {
                            await this.uralpro.get('sdk').rewardedBreak();
                            // В Poki SDK награда всегда выдается при успешном просмотре
                            this.uralpro.log("Пользователь получил награду!");
                            this.uralpro.set("ysdkAdvStart", "0");
                            additionalOnRewarded?.();
                        }
                        
                        this.uralpro.log("Вознаграждаемая реклама Poki закрыта.");
                        this.uralpro.set("ysdkAdvStart", "0");
                        additionalOnClose?.();
                    } catch (error) {
                        this.uralpro.error("Ошибка показа вознаграждаемой рекламы Poki:", error);
                        this.uralpro.set("ysdkAdvStart", "0");
                        additionalOnError?.(error);
                    }
                    return;
                }
                
                if (!this.uralpro.get('isSdkReady') || !this.uralpro.get('sdk')?.adv) {
                    this.uralpro.warn("Реклама недоступна.");
                    return;
                }
                try {
                    await this.uralpro.get('sdk').adv.showRewardedVideo({
                        callbacks: {
                            onOpen: () => {
                                this.uralpro.log("Вознаграждаемая реклама открыта.");
                                this.uralpro.set("ysdkAdvStart", "1");
                                additionalOnOpen?.();
                            },
                            onRewarded: () => {
                                this.uralpro.log("Пользователь получил награду!");
                                this.uralpro.set("ysdkAdvStart", "0");
                                additionalOnRewarded?.();
                            },
                            onClose: () => {
                                this.uralpro.log("Вознаграждаемая реклама закрыта.");
                                this.uralpro.set("ysdkAdvStart", "0");
                                additionalOnClose?.();
                            },
                            onError: (error) => {
                                this.uralpro.error("Ошибка показа вознаграждаемой рекламы:", error);
                                this.uralpro.set("ysdkAdvStart", "0");
                                additionalOnError?.(error);
                            },
                        },
                    });
                } catch (error) {
                    this.uralpro.error("Ошибка при вызове вознаграждаемой рекламы:", error);
                }
            },
            showBannerAdv: (show = true) => {
                const sdk = this.uralpro.get('sdk');
                if (!sdk || !sdk.adv) {
                    if(typeof AndroidFunction !== "undefined"){
                        AndroidFunction.showBannerAd();
                    } else {
                        this.uralpro.error("SDK или модуль рекламы не доступен");
                    }
                    return;
                }
                if (show) {
                    sdk.adv.showBannerAdv();  
                    this.uralpro.log("Баннер рекламы отображается.");
                } else {
                    sdk.adv.hideBannerAdv();
                    this.uralpro.log("Баннер рекламы скрывается.");
                }
            }
        };

        this.audio = {
            config: {
                sound: true,
                backgroundAudio: true,
                nameBackgroundAudio: ""
            },
            context: null,
            tracks: new Map(),
            gainNodes: new Map(),
            audioLoadedCount: 0,
            totalAudioCount: 0,
            
            platform: this.uralpro.get('platform') == "android" ? ((typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined') ? "web" : (window.location.protocol === "file:" ? "file" : "web")) : (window.location.protocol === "file:" ? "file" : "web"),  
            
            isAllLoaded: false,
            loadCallbacks: [],
            isMuted: false,
            volumeBackup: new Map(),
            pausedTracks: new Map(),
            playingTracks: new Map(),
            
            // Пул аудио элементов для предотвращения наложения звуков
            audioPool: new Map(), // Map для хранения пулов аудио элементов
            poolSize: 3, // Количество аудио элементов в пуле для каждого звука
            lastPlayTime: new Map(), // Время последнего воспроизведения для каждого звука
            debounceDelay: 50, // Минимальный интервал между воспроизведениями в миллисекундах

            init: () => {
                if (this.audio.platform === "web" && !this.audio.context) {
                    try {
                        this.audio.context = new(window.AudioContext || window.webkitAudioContext)();
                        this.uralpro.log("AudioContext инициализирован.", `style: color: grey; font-weight: bold; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                    } catch (e) {
                        this.uralpro.error("Ошибка инициализации AudioContext:", e);
                    }
                    document.addEventListener("click", () => {
                        if (this.audio.context?.state === "suspended") {
                            this.audio.context.resume().then(() => {
                                this.uralpro.log("AudioContext возобновлён после пользовательского взаимодействия.", `style: color: grey; font-weight: bold; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                            }).catch((error) => {
                                this.uralpro.error("Ошибка возобновления AudioContext:", error);
                            });
                        }
                    });
                }
            },

            // Метод для создания пула аудио элементов
            createAudioPool: (name, src, volume = 1.0) => {
                if (this.audio.audioPool.has(name)) {
                    return; // Пул уже создан
                }
                
                const pool = [];
                for (let i = 0; i < this.audio.poolSize; i++) {
                    if (this.audio.platform === "file") {
                        const audio = new Audio(src);
                        audio.volume = volume;
                        audio.preload = 'auto';
                        pool.push(audio);
                    } else {
                        // Для AudioContext создаем буферы
                        const request = new XMLHttpRequest();
                        request.open("GET", src, true);
                        request.responseType = "arraybuffer";
                        request.onload = () => {
                            this.audio.context.decodeAudioData(
                                request.response,
                                (buffer) => {
                                    pool.push(buffer);
                                },
                                (error) => {
                                    this.uralpro.error(`Ошибка декодирования аудио для пула "${name}":`, error);
                                }
                            );
                        };
                        request.send();
                    }
                }
                this.audio.audioPool.set(name, pool);
            },

            load: (name, src, volume = 1.0, loop = false) => {
                this.audio.totalAudioCount++;
                
                // Создаем пул аудио элементов для коротких звуков (не для зацикленных)
                if (!loop) {
                    this.audio.createAudioPool(name, src, volume);
                }
                
                if (this.audio.platform === "file") {
                    const player = new Audio(src);
                    player.loop = loop;
                    player.volume = volume;
                    player.addEventListener("canplaythrough", () => {
                        if (!this.audio.tracks.has(name)) {
                            this.audio.tracks.set(name, {
                                player,
                                volume,
                                loop
                            });
                            this.audio.onLoadComplete(name);
                        }
                    });
                    player.addEventListener("error", () => {
                        this.uralpro.error(`Ошибка загрузки аудиофайла "${name}".`);
                        this.audio.onLoadComplete(name, false);
                    });
                } else {
                    const request = new XMLHttpRequest();
                    request.open("GET", src, true);
                    request.responseType = "arraybuffer";
                    request.onload = () => {
                        this.audio.context.decodeAudioData(
                            request.response,
                            (buffer) => {
                                if (!this.audio.tracks.has(name)) {
                                    this.audio.tracks.set(name, {
                                        buffer,
                                        source: null,
                                        volume,
                                        loop
                                    });
                                    this.audio.onLoadComplete(name);
                                }
                            },
                            (error) => {
                                this.uralpro.error(`Ошибка декодирования аудио "${name}":`, error);
                                this.audio.onLoadComplete(name, false);
                            }
                        );
                    };
                    request.onerror = () => {
                        this.uralpro.error(`Ошибка загрузки аудиофайла "${name}".`);
                        this.audio.onLoadComplete(name, false);
                    };
                    request.send();
                }
            },

            onLoadComplete: (name, success = true) => {
                if (success) {
                    this.uralpro.log(`Аудиофайл "${name}" успешно загружен.`, `style: color: grey; font-weight: bold; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                }
                this.audio.audioLoadedCount++;
                if (this.audio.audioLoadedCount === this.audio.totalAudioCount) {
                    this.audio.isAllLoaded = true;

                    this.uralpro.log(`Все аудиофайлы успешно загружены!`, `style: color: #2cb64d; font-weight: bold; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                    this.audio.loadCallbacks.forEach((callback) => {
                        if (callback) callback();
                    });
                    document.addEventListener('click', () => {
                        if (this.uralpro.get("iStartBackgroundAudio") != 1) {
                            this.uralpro.set("iStartBackgroundAudio", 1);
                            if (this.audio.config.nameBackgroundAudio != "") {
                                uralprojs.audio.play(this.audio.config.nameBackgroundAudio);
                            }
                        }
                    });
                }
            },

            play: (name, startTime = true) => {
                // Проверка: воспроизводить ли звук или фоновую музыку
                if (this.audio.config.nameBackgroundAudio === name) {
                    if (!this.audio.config.backgroundAudio) {
                        return;
                    }
                } else {
                    if (!this.audio.config.sound) {
                        return;
                    }
                }

                // Проверка: все ли аудиофайлы загружены
                if (!this.audio.isAllLoaded) {
                    this.uralpro.warn("Не все аудиофайлы загружены. Попробуйте позже.");
                    return;
                }

                // Получение трека
                const track = this.audio.tracks.get(name);
                if (!track) {
                    this.uralpro.error(`Трек "${name}" не найден.`);
                    return;
                }

                // Проверяем дебаунсинг для коротких звуков (не зацикленных)
                if (!track.loop) {
                    const currentTime = Date.now();
                    const lastTime = this.audio.lastPlayTime.get(name) || 0;
                    
                    if (currentTime - lastTime < this.audio.debounceDelay) {
                        return; // Игнорируем слишком частые воспроизведения
                    }
                    
                    this.audio.lastPlayTime.set(name, currentTime);
                }

                if (this.audio.platform === "file") {
                    // Обработка для платформы file
                    if (track.loop) {
                        // Для зацикленных звуков используем стандартное воспроизведение
                        if (startTime || this.audio.pausedTracks.has(name)) {
                            track.player.currentTime = this.audio.pausedTracks.get(name) || 0;
                            this.audio.pausedTracks.delete(name);
                        }
                        track.player.play().then(() => {
                            this.uralpro.log(`Аудиотрек "${name}" воспроизводится.`, `style: color: grey; font-weight: bold; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                            this.audio.playingTracks.set(name, true);
                        }).catch((error) => {
                            this.uralpro.error(`Ошибка воспроизведения "${name}":`, error);
                        });
                    } else {
                        // Для коротких звуков используем пул аудио элементов
                        const pool = this.audio.audioPool.get(name);
                        if (pool && pool.length > 0) {
                            // Ищем свободный аудио элемент
                            let audioElement = null;
                            for (let i = 0; i < pool.length; i++) {
                                if (pool[i].paused || pool[i].ended) {
                                    audioElement = pool[i];
                                    break;
                                }
                            }
                            
                            if (audioElement) {
                                audioElement.currentTime = 0;
                                audioElement.play().catch((error) => {
                                    this.uralpro.error(`Ошибка воспроизведения из пула "${name}":`, error);
                                });
                            }
                        } else {
                            // Fallback к стандартному воспроизведению
                            track.player.currentTime = 0;
                            track.player.play().catch((error) => {
                                this.uralpro.error(`Ошибка воспроизведения "${name}":`, error);
                            });
                        }
                    }
                } else {
                    // Обработка для платформы web (AudioContext)
                    if (track.loop) {
                        // Для зацикленных звуков используем стандартное воспроизведение
                        if (this.audio.playingTracks.has(name) && track.loop) {
                            this.uralpro.log(`Аудиотрек "${name}" уже воспроизводится в режиме loop.`, `style: color: grey; font-weight: bold; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                            return;
                        }

                        // Создаем источник и узел усиления
                        const source = this.audio.context.createBufferSource();
                        const gainNode = this.audio.context.createGain();

                        // Настройка источника
                        source.buffer = track.buffer;
                        gainNode.gain.value = this.audio.isMuted ? 0 : track.volume;
                        source.connect(gainNode);
                        gainNode.connect(this.audio.context.destination);
                        source.loop = track.loop;

                        // Вычисляем startOffset
                        const startOffset = this.audio.pausedTracks.has(name) ? this.audio.pausedTracks.get(name) : 0;

                        // Проверяем, является ли startOffset корректным числом
                        if (!Number.isFinite(startOffset) || startOffset < 0) {
                            this.uralpro.warn(`Некорректный startOffset (${startOffset}). Воспроизведение с начала.`);
                            source.start(0); // Воспроизведение с начала
                        } else {
                            source.start(0, startOffset); // Воспроизведение с позиции
                        }

                        // Удаляем состояние "приостановлено"
                        this.audio.pausedTracks.delete(name);

                        // Сохраняем источник и узел усиления
                        track.source = source;
                        this.audio.gainNodes.set(name, gainNode);
                        this.audio.playingTracks.set(name, true);
                        this.uralpro.log(`Аудиотрек "${name}" воспроизводится через AudioContext.`, `style: color: grey; font-weight: bold; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                    } else {
                        // Для коротких звуков используем пул буферов
                        const pool = this.audio.audioPool.get(name);
                        if (pool && pool.length > 0) {
                            // Создаем источник и узел усиления
                            const source = this.audio.context.createBufferSource();
                            const gainNode = this.audio.context.createGain();

                            // Настройка источника
                            source.buffer = pool[0]; // Используем первый буфер из пула
                            gainNode.gain.value = this.audio.isMuted ? 0 : track.volume;
                            source.connect(gainNode);
                            gainNode.connect(this.audio.context.destination);
                            source.loop = false;

                            // Воспроизводим с начала
                            source.start(0);
                            
                            // Очищаем источник после завершения
                            source.onended = () => {
                                source.disconnect();
                                gainNode.disconnect();
                            };
                        } else {
                            // Fallback к стандартному воспроизведению
                            const source = this.audio.context.createBufferSource();
                            const gainNode = this.audio.context.createGain();

                            source.buffer = track.buffer;
                            gainNode.gain.value = this.audio.isMuted ? 0 : track.volume;
                            source.connect(gainNode);
                            gainNode.connect(this.audio.context.destination);
                            source.loop = false;

                            source.start(0);
                            
                            source.onended = () => {
                                source.disconnect();
                                gainNode.disconnect();
                            };
                        }
                    }
                }
            },

            stop: (name) => {
                const track = this.audio.tracks.get(name);
                if (!track) {
                    this.uralpro.error(`Трек "${name}" не найден.`);
                    return;
                }

                if (this.audio.platform === "file") {
                    if (!track.player.paused) {
                        track.player.pause();
                        track.player.currentTime = 0;
                        this.uralpro.log(`Аудиотрек "${name}" остановлен.`, `style: color: grey; font-weight: bold; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                        this.audio.playingTracks.delete(name);
                    }
                } else if (track.source) {
                    track.source.stop();
                    track.source = null;
                    this.audio.gainNodes.delete(name);
                    this.uralpro.log(`Аудиотрек "${name}" остановлен через AudioContext.`, `style: color: grey; font-weight: bold; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                    this.audio.playingTracks.delete(name);
                }
            },

            pause: (name) => {
                const track = this.audio.tracks.get(name);
                if (!track) {
                    this.uralpro.error(`Трек "${name}" не найден.`);
                    return;
                }

                if (this.audio.platform === "file") {
                    if (!track.player.paused) {
                        track.player.pause();
                        this.uralpro.log(`Аудиотрек "${name}" приостановлен.`, `style: color: grey; font-weight: bold; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                        this.audio.pausedTracks.set(name, track.player.currentTime);
                        this.audio.playingTracks.delete(name);
                    }
                } else if (track.source) {
                    const currentTime = this.audio.context.currentTime;
                    const elapsedTime = currentTime - track.source.startTime;
                    track.source.stop();
                    this.uralpro.log(`Аудиотрек "${name}" приостановлен через AudioContext.`, `style: color: grey; font-weight: bold; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                    this.audio.pausedTracks.set(name, elapsedTime);
                    this.audio.playingTracks.delete(name);
                }
            },

            setVolume: (name, volume) => {
                const track = this.audio.tracks.get(name);
                if (!track) {
                    this.uralpro.error(`Трек "${name}" не найден.`);
                    return;
                }

                if (this.audio.platform === "file") {
                    track.player.volume = this.audio.isMuted ? 0 : volume;
                } else {
                    const gainNode = this.audio.gainNodes.get(name);
                    if (gainNode) gainNode.gain.value = this.audio.isMuted ? 0 : volume;
                }
                track.volume = volume;
            },

            muteAll: () => {
                if (this.audio.isMuted) return;
                this.audio.tracks.forEach((track, name) => {
                    this.audio.volumeBackup.set(name, track.volume);
                    this.audio.setVolume(name, 0);
                });
                this.audio.isMuted = true;
                this.uralpro.log("Громкость всех треков отключена.", `style: color: grey; font-weight: bold; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);

            },

            unmuteAll: () => {
                if (!this.audio.isMuted) return;
                this.audio.tracks.forEach((track, name) => {
                    const volume = this.audio.volumeBackup.get(name);
                    if (volume !== undefined) {
                        this.audio.setVolume(name, volume);
                        if (this.audio.platform === "file") {
                            track.player.volume = volume;
                        } else {
                            const gainNode = this.audio.gainNodes.get(name);
                            if (gainNode) gainNode.gain.value = volume;
                        }
                    }
                });
                this.audio.isMuted = false;
                this.uralpro.log("Громкость всех треков восстановлена.", `style: color: grey; font-weight: bold; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
            },

            update: () => {
                this.audio.tracks.forEach((track, name) => {
                    if (this.audio.config.nameBackgroundAudio === name) {
                        this.uralpro.log(`Обновление для фоновой музыки: ${name}, backgroundAudio: ${this.audio.config.backgroundAudio}`, `style: color: grey; font-weight: bold; background-color: #f0f0f0; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                        if (this.audio.config.backgroundAudio) {
                            if (name !== "" && !this.audio.playingTracks.has(name)) {
                                uralprojs.audio.play(name, false);
                            }
                        } else {
                            uralprojs.audio.pause(name);
                        }
                    } else {
                        if (!this.audio.config.sound) {
                            uralprojs.audio.stop(name);
                        }
                    }
                });
            },

            onAllAudioLoaded: (callback) => {
                if (this.audio.isAllLoaded) {
                    callback();
                } else {
                    this.audio.loadCallbacks.push(callback);
                }
            },
        };

        // Приватные хранилища (через замыкания)
        const savedFunctions = {};
        const savedVariables = {};

        this.js = {
            //случайное число между
            getRandomIntInclusive(min, max) {
                min = Math.ceil(min);
                max = Math.floor(max);
                return Math.floor(Math.random() * (max - min + 1)) + min;
            },
            
            // Метод для генерации UUID версии 4 (случайный)
            generateUUID() {
                // Используем криптографически стойкий генератор случайных чисел, если он доступен
                if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                    return crypto.randomUUID(); // Современный и рекомендуемый способ
                }
                
                // Фолбэк для старых браузеров
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            },

            // Сохранение функции
            saveFunction(name, fn) {
                if (typeof fn === 'function') {
                    savedFunctions[name] = fn;
                } else {
                    this.uralpro.error('Передано не функция:', fn);
                }
            },

            // Вызов функции
            callFunction(name, ...args) {
                if (typeof savedFunctions[name] === 'function') {
                    return savedFunctions[name](...args);
                } else {
                    this.uralpro.error(`Функция с именем "${name}" не найдена.`);
                }
            },

            // Сохранение переменной
            saveVariable(name, value, type = 'var') {
                if (['var', 'let', 'const', 'val'].includes(type)) {
                    savedVariables[name] = {
                        value,
                        type
                    };
                } else {
                    this.uralpro.error(`Некорректный тип переменной: "${type}".`);
                }
            },

            // Получение переменной
            getVariable(name) {
                if (savedVariables.hasOwnProperty(name)) {
                    return savedVariables[name].value;
                } else {
                    this.uralpro.error(`Переменная с именем "${name}" не найдена.`);
                }
            },

            // Обновление переменной (для let и var)
            updateVariable(name, newValue) {
                if (savedVariables.hasOwnProperty(name)) {
                    const varData = savedVariables[name];
                    if (varData.type === 'let' || varData.type === 'var') {
                        varData.value = newValue;
                    } else {
                        this.uralpro.error(`Переменная "${name}" объявлена как ${varData.type} и не может быть изменена.`);
                    }
                } else {
                    this.uralpro.error(`Переменная с именем "${name}" не найдена.`);
                }
            }
        };

        // Защита от изменений только для методов
        Object.freeze(this.js.saveFunction);
        Object.freeze(this.js.callFunction);
        Object.freeze(this.js.saveVariable);
        Object.freeze(this.js.getVariable);
        Object.freeze(this.js.updateVariable);

        document.addEventListener("DOMContentLoaded", () => {
            this.audio.init();
            this.uralpro.init();
            
            // Автоматическое обнаружение настроек сразу после инициализации
            this.autoDiscoverSettings();
            
            // Создание кнопки менеджера сохранений, если разрешено
            setTimeout(() => {
                this.saveManager.createSaveManagerButton();
            }, 1000); // Небольшая задержка для полной инициализации
        });
    }

    get version() {
        return "0.26";
    }

    get language() {
        return this.uralpro.get('lang');
    }

    get platform() {
        return this.uralpro.get('platform');
    }

    get platform_() {
        return this.uralpro.get('_player');
    }

    get serverTime() {
        var r = null;
        if (this.uralpro.get('platform') == "yandex") {
            if (this.uralpro.get('sdk')) {
                r = this.uralpro.get('sdk').serverTime();
            }
        }else{
            r = new Date().getTime();
        }
        return r;
    }

    get gamesList() {
        var result = null;
        if (this.uralpro.get('platform') == "yandex") {
            if (this.uralpro.get('sdk')) {
                result = this.uralpro.get('yandex_getAllGames');
            }
        }
        return result;
    }

    saveData = () => {
        if (this.uralpro.get('setup_saveData') == 1) {
            if (this.platform == "file") {
                this.saveDataUrgently();
            } else {
                this.uralpro.log("SaveDataStart", `style: color: grey; font-weight: bold; background-color: black; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                if (this.uralpro.timeoutId_saveData) {
                    this.uralpro.log("NoSaveData [Time]", `style: color: #707344; font-weight: bold; background-color: black; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                    clearTimeout(this.uralpro.timeoutId_saveData);
                } else {
                    this.saveDataUrgently();
                }
                this.uralpro.timeoutId_saveData = setTimeout(() => {
                    this.saveDataUrgently();
                }, 3100);
            }
        }
    };

    saveDataUrgently = () => {
        if (this.uralpro.get('setup_saveData') == 1) {
            for (let i = 0; i < this.uralpro.save_idArray.length; i++) {
                const idname = this.uralpro.save_id000 + this.uralpro.save_idArray[i][0];
                const dataN = this.uralpro.get('mapDataApp').get(idname);

                // Нормализуем текущее значение так же, как мы делаем при сохранении,
                // чтобы корректно сравнить с последним сохранённым снепшотом
                let normalizedValue = dataN;
                if (dataN !== undefined && dataN !== null) {
                    const key = this.uralpro.save_idArray[i][0];
                    if (this.uralpro.shouldCompress(key, dataN)) {
                        if (typeof dataN === 'object') {
                            normalizedValue = this.uralpro.compressData(JSON.stringify(dataN));
                        } else {
                            normalizedValue = this.uralpro.compressData(dataN);
                        }
                    } else {
                        if (typeof dataN === 'object') {
                            normalizedValue = JSON.stringify(dataN);
                        }
                    }
                }

                this.uralpro.get('saveDataOld1').set(idname, normalizedValue);
            }

            if (!this.uralpro.areMapsEqual(this.uralpro.get('saveDataOld1'), this.uralpro.get('saveDataOld2'))) {
                for (let i = 0; i < this.uralpro.save_idArray.length; i++) {
                    const idname = this.uralpro.save_id000 + this.uralpro.save_idArray[i][0];
                    const dataN = this.uralpro.get('mapDataApp').get(idname);
                    
                    // Сжимаем данные только при сохранении, если это необходимо
                    let dataToSave = dataN;
                    if (dataN !== undefined && dataN !== null) {
                        const key = this.uralpro.save_idArray[i][0];
                        if (this.uralpro.shouldCompress(key, dataN)) {
                            // Если данные - объект, сериализуем в JSON перед сжатием
                            if (typeof dataN === 'object') {
                                dataToSave = this.uralpro.compressData(JSON.stringify(dataN));
                            } else {
                                dataToSave = this.uralpro.compressData(dataN);
                            }
                        } else {
                            // Если данные - объект, сериализуем в JSON
                            if (typeof dataN === 'object') {
                                dataToSave = JSON.stringify(dataN);
                            }
                        }
                    }
                    
                    if (this.uralpro.get("getPlayer") == "yandex") {
                        this.uralpro.get('mapDataYandexApp').set(idname, dataToSave);
                        this.uralpro.get('saveDataOld2').set(idname, dataToSave);
                    } else {
                        localStorage.setItem(idname, dataToSave);
                        this.uralpro.get('saveDataOld2').set(idname, dataToSave);
                    }
                }
                if (this.uralpro.get('platform') === "yandex") {
                    if (this.uralpro.get("getPlayer") == "yandex") {
                        this.uralpro.get('_player').setData({
                            data: Array.from(this.uralpro.get('mapDataYandexApp')),
                        }).then(() => {
                            this.uralpro.log("SaveData [Yandex Games]", `style: color: green; font-weight: bold; background-color: black; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                            
                            // Сохраняем время последнего сохранения
                            localStorage.setItem('uralpro_lastSaveTime', Date.now().toString());
                            
                            if (this.uralpro.config.codeAfterSaving) {
                                this.uralpro.config.codeAfterSaving();
                            }
                        });
                    }
                } else {
                    this.uralpro.log("SaveData [LocalStorage]", `style: color: green; font-weight: bold; background-color: black; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);

                    // Сохраняем время последнего сохранения
                    localStorage.setItem('uralpro_lastSaveTime', Date.now().toString());

                    if (this.uralpro.config.codeAfterSaving) {
                        this.uralpro.config.codeAfterSaving();
                    }
                }
            } else {
                this.uralpro.log("NoSaveData [No changes]", `style: color: #707344; font-weight: bold; background-color: black; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
            }
        }
    };

    async requestReview(onSuccess, onClose, onError) {
        if (!this.uralpro.get('sdk')?.feedback) {
            this.uralpro.warn("Функция оценки игры недоступна.");
            if (typeof onError === 'function') onError();
            return;
        }

        if (this.uralpro.get('yandex_canReview') == true) {
            this.uralpro.get('sdk').feedback.canReview()
                .then(({
                    value,
                    reason
                }) => {
                    this.uralpro.log("Запрос оценки игры выполнен.");
                    this.uralpro.set('yandex_canReview', value);
                    if (value) {
                        this.uralpro.get('sdk').feedback.requestReview()
                            .then(({
                                feedbackSent
                            }) => {
                                if (feedbackSent) {
                                    if (typeof onSuccess === 'function') {
                                        onSuccess();
                                    }
                                } else {
                                    if (typeof onClose === 'function') {
                                        onClose();
                                    }
                                }
                                this.uralpro.set('yandex_canReview', false);
                            })
                    } else {
                        if (typeof onError === 'function') onError();
                    }
                })
        } else {
            if (typeof onError === 'function') onError();
        }
    }
    get checkCanReview() {
        var result = null;
        if (this.uralpro.get('platform') == "yandex") {
            if (this.uralpro.get('sdk')) {
                result = this.uralpro.get('yandex_canReview');
            }
        }
        return result;
    }

    async gameStart() {
        // Поддержка Poki SDK
        if (this.uralpro.get('platform') === "poki" && this.uralpro.get('isSdkReady') && this.uralpro.get('sdk')) {
            try {
                if (typeof this.uralpro.get('sdk').gameplayStart === 'function') {
                    this.uralpro.get('sdk').gameplayStart();
                }
            } catch (error) {
                this.uralpro.error("Ошибка gameStart (Poki):", error);
            }
            return;
        }
        
        if (!this.uralpro.get('isSdkReady') || !this.uralpro.get('sdk')?.features) {
            return;
        }
        try {
            await this.uralpro.get('sdk').features.GameplayAPI?.start();
        } catch (error) {
            this.uralpro.error("Ошибка gameStart:", error);
        }
    }

    async gameStop() {
        // Поддержка Poki SDK
        if (this.uralpro.get('platform') === "poki" && this.uralpro.get('isSdkReady') && this.uralpro.get('sdk')) {
            try {
                if (typeof this.uralpro.get('sdk').gameplayStop === 'function') {
                    this.uralpro.get('sdk').gameplayStop();
                }
            } catch (error) {
                this.uralpro.error("Ошибка gameStop (Poki):", error);
            }
            return;
        }
        
        if (!this.uralpro.get('isSdkReady') || !this.uralpro.get('sdk')?.features) {
            return;
        }
        try {
            await this.uralpro.get('sdk').features.GameplayAPI?.stop();
        } catch (error) {
            this.uralpro.error("Ошибка gameStop:", error);
        }
    }

    documentVisibility({
        onHidden = () => {},
        onVisible = () => {}
    } = {}) {
        const setupVisibilityHandlers = () => {
            if (this.uralpro.get('platform') === "yandex") {
                const sdk = this.uralpro.get('sdk');
                if (!sdk?.on || !sdk?.off) {
                    this.uralpro.error("Yandex SDK не поддерживает события game_api_pause.");
                    return;
                }
                if (typeof onHidden === "function") {
                    sdk.on('game_api_pause', onHidden);
                }
                if (typeof onVisible === "function") {
                    sdk.on('game_api_resume', onVisible);
                }
                this.uralpro.log("Подписка на события game_api_pause и game_api_resume выполнена.", `style: color: blue; font-weight: bold; background-color: yellow; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
            } else {
                document.addEventListener("visibilitychange", () => {
                    if (document.hidden) {
                        if (this.uralpro.config.audioMuteDocumentVisibility) {
                            this.audio.muteAll(); // Отключаем звук  
                        }
                        this.uralpro.set('isPageHidden', true);
                        if (typeof onHidden === "function") {
                            onHidden();
                        }
                    } else {
                        if (this.audio.context?.state === "suspended") {
                            this.audio.context.resume(); // Возобновляем AudioContext
                        }
                        if (this.uralpro.config.audioMuteDocumentVisibility) {
                            this.audio.unmuteAll(); // Включаем звук 
                        }
                        this.uralpro.set('isPageHidden', false);
                        if (typeof onVisible === "function") {
                            onVisible();
                        }
                    }
                }, false);
                this.uralpro.log("Обработчик visibilitychange установлен для браузера.", `style: color: blue; font-weight: bold; background-color: yellow; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
            }
        };
        const waitForReadiness = () => {
            const MAX_WAIT = 10000; // 10 секунд максимум
            const start = Date.now();
            
            const check = () => {
                const isReady = this.uralpro.get('isLoaded') && 
                               this.uralpro.get('isSdkReady') && 
                               this.uralpro.get('isGameReady');
                
                if (isReady || this.uralpro.get('platform') === "file" || this.uralpro.get('platform') === "unknown") {
                    setupVisibilityHandlers();
                } else if (Date.now() - start < MAX_WAIT) {
                    setTimeout(check, 1000);
                } else {
                    this.uralpro.error("Таймаут ожидания готовности платформы");
                }
            };
            check();
        };
        waitForReadiness();
    }

    statusPurchase(key) {
    if (this.uralpro.isCalledFromConsole()) {
        this.uralpro.error("Изменение из консоли запрещено.");
        return;
    }
        let s = false;
        if (key) {
            if (this.uralpro.get('platform') == "yandex") {
                s = (this.productsPurchase(key) != null) && (this.uralpro.has("yaPayments") && this.uralpro.get("getPlayer") === "yandex" && this.uralpro.has("yaPayments"));
            }
            if(this.uralpro.get('platform') == "android") {
                s = (this.productsPurchase(key) != null);
            }
        } else {
            if (this.uralpro.get('platform') == "yandex") {
                s = (this.uralpro.has("yaPayments") && this.uralpro.get("getPlayer") === "yandex" && this.uralpro.has("yaPayments"));
            }
            if(this.uralpro.get('platform') == "android") {
                s = this.uralpro.has("android_products");
            }
        }
        return s;
    }
    productsPurchase(key) {
    if (this.uralpro.isCalledFromConsole()) {
        this.uralpro.error("Изменение из консоли запрещено.");
        return;
    }
        let r = null;
        if (this.statusPurchase()) { 
            if (this.uralpro.get('platform') == "yandex") {
                const products = this.uralpro.get("yandex_products");
                if (key) {
                    const iData = products.find(item => item.id === key);
                    if (iData) {
                        r = iData;
                    } else {
                        this.uralpro.error("productsPurchase. [" + key + "] - объект не найден");
                        r = null;
                    }
                } else {
                    r = products;
                }
            }
            if(this.uralpro.get('platform') == "android") {
                const products = this.uralpro.get("android_products");
                if (key) {
                    const iData = products.find(item => item.id === key);
                    if (iData) {
                        r = iData;
                    } else {
                        this.uralpro.error("productsPurchase. [" + key + "] - объект не найден");
                        r = null;
                    }
                } else {
                    r = products;
                }
            }
        }
        return r;
    }
    consumePurchase(endFun) {
    if (this.uralpro.isCalledFromConsole()) {
        this.uralpro.error("Изменение из консоли запрещено.");
        return;
    }
        if (!this.statusPurchase()) return;

        if (this.uralpro.get('platform') == "yandex") {
            const yaPayments = this.uralpro.get("yaPayments");
            if (!yaPayments) {
                this.uralpro.error("Payments module not found");
                return;
            }

            (async () => {
                try {
                    const purchases = await yaPayments.getPurchases();

                    for (const purchase of purchases) {
                        try {
                            // Консумируем покупку
                            await yaPayments.consumePurchase(purchase.purchaseToken);

                            // Ищем обработчик
                            const processor = this.uralpro.config?.purchaseFunctionList?.find(
                                item => item.key === purchase.productID
                            );

                            if (!processor) {
                                this.uralpro.warn(`No processor for: ${purchase.productID}`);
                                continue;
                            }

                            // Выполняем логику обработки
                            await processor.action(this.productsPurchase(purchase.productID), purchase);

                            if (endFun) {
                                endFun();
                            }

                            // Сохраняем данные
                            this.saveDataUrgently();
                            this.uralpro.log(`Покупка ${purchase.productID} обработана`);

                        } catch (err) {
                            this.uralpro.error(`Ошибка для ${purchase.productID}:`, err);
                        }
                    }
                } catch (error) {
                    this.uralpro.error("Общая ошибка:", error);
                }
            })();
        }
    }

    getPurchase(key, endFun, errorFun) {
    if (this.uralpro.isCalledFromConsole()) {
        this.uralpro.error("Изменение из консоли запрещено.");
        return;
    }

        if (this.statusPurchase() && key) {
            if (this.uralpro.get('platform') == "yandex") {
                let yaPayments = this.uralpro.get("yaPayments");
                yaPayments.purchase({
                    id: key
                }).then(purchase => {
                    this.consumePurchase(endFun);
                }).catch(err => {
                    console.error("purchase - " + key, err);
                    if (typeof errorFun === "function") {
                        errorFun();
                    }
                })
            }
            if (this.uralpro.get('platform') == "android") {
                if (typeof AndroidFunction !== 'undefined' && AndroidFunction.buyProduct) {
                    // Сохраняем callback'и для вызова после получения результата от Android
                    window._androidPurchaseCallbacks = window._androidPurchaseCallbacks || {};
                    window._androidPurchaseCallbacks[key] = { endFun, errorFun };
                    
                    // Вызываем покупку (результат придет через window.onPurchaseSuccess/Error)
                    AndroidFunction.buyProduct(key);
                    console.log(`📱 Запущена покупка Android для ${key}`);
                } else {
                    console.error("AndroidFunction.buyProduct недоступна");
                    if (typeof errorFun === "function") {
                        errorFun();
                    }
                }
            }
        }
    }

    getFlags(key, default_value) {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Изменение из консоли запрещено.");
            return;
        }
        let value = default_value;
        if (this.uralpro.get('platform') == "yandex") {
            if (key) {
                const flags = this.uralpro.get('yandex_flags') || {};
                value = flags[key] !== undefined ? flags[key] : default_value;
            } else {
                value = this.uralpro.get('yandex_flags');
            }
        }
        return value;
    }

    statusShortcut() {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Изменение из консоли запрещено.");
            return;
        }
        let value = false;
        if (this.uralpro.get('platform') == "yandex") {
            value = this.uralpro.get('shortcut_available');
        }
        return value;
    }

    async addShortcut(f, ff) {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Изменение из консоли запрещено.");
            return;
        }
        
        try {
            if (this.statusShortcut()) {
                const result = await this.uralpro.get('sdk').shortcut.showPrompt();
                this.uralpro.set('shortcut_result', result.outcome);
                if (result.outcome === 'accepted'){
                    if (typeof f === "function") {
                        f();
                    }
                }else{
                    if (typeof ff === "function") {
                        ff();
                    }
                }
                this.uralpro.log('Результат создания ярлыка:', result.outcome);
            }
        } catch (error) {
            this.uralpro.error("Ошибка при создании ярлыка:", error);
            this.uralpro.set('shortcut_result', 'error');
        }
    }

    setGameReady() {
        this.uralpro.set('isGameReady', true);
        this.uralpro.log("Ресурсы игры загружены.", `style: color: green; font-weight: bold; background-color: black; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
        this.ready();
        this.consumePurchase();
    }

    ready() {
        if (this.uralpro.get('platform') == "yandex" && (!this.uralpro.get('isLoaded') || !this.uralpro.get('isSdkReady') || !this.uralpro.get('isGameReady'))) {
            this.uralpro.log("SDK или игра ещё не готовы. Ожидание...");
            setTimeout(() => this.ready(), 1000);
            return;
        }
        
        // Проверка готовности для Poki
        if (this.uralpro.get('platform') == "poki" && (!this.uralpro.get('isSdkReady') || !this.uralpro.get('isGameReady'))) {
            this.uralpro.log("SDK или игра ещё не готовы. Ожидание...");
            setTimeout(() => this.ready(), 1000);
            return;
        }
        
        this.uralpro.log("SDK и игра готовы!", `style: color: green; font-weight: bold; background-color: black; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);

        // Yandex SDK
        if (this.uralpro.get('platform') === "yandex") {
            this.uralpro.get('sdk')?.features?.LoadingAPI?.ready();
        }
        
        // Poki SDK
        if (this.uralpro.get('platform') === "poki" && this.uralpro.get('sdk')) {
            if (typeof this.uralpro.get('sdk').gameLoadingFinished === 'function') {
                this.uralpro.get('sdk').gameLoadingFinished();
            }
        }
    }
    serverTime() {
        var r = null;
        if (this.uralpro.get('platform') == "yandex") {
            if (this.uralpro.get('sdk')) {
                r = this.uralpro.get('sdk').serverTime();
            }
        }else{
            r = new Date().getTime();
        }
        return r;
    }

    checkInternetConnection() {
        function formatDate(date) {
            let day = String(date.getDate()).padStart(2, '0');
            let month = String(date.getMonth() + 1).padStart(2, '0');
            let year = String(date.getFullYear()).slice(-2);
            let hours = String(date.getHours()).padStart(2, '0');
            let minutes = String(date.getMinutes()).padStart(2, '0');
            let seconds = String(date.getSeconds()).padStart(2, '0');

            return `${day}${month}${year}${hours}${minutes}${seconds}`;
        }

        return new Promise((resolve) => {
            let now = new Date();
            let formattedDate = formatDate(now);
            
            // Определяем URL для проверки интернета в зависимости от платформы
            let checkUrl;
            const platform = this.uralpro.get('platform');
            
            if (platform === "poki") {
                // Для Poki используем их домен, который разрешен CSP политикой
                checkUrl = "https://poki.com/favicon.ico?" + formattedDate;
            } else if (platform === "yandex") {
                // Для Yandex используем их домен
                checkUrl = "https://yastatic.net/favicon.ico?" + formattedDate;
            } else {
                // Для других платформ используем нейтральный домен или yastatic
                checkUrl = "https://www.google.com/favicon.ico?" + formattedDate;
            }
            
            if (navigator.onLine) {
                fetch(checkUrl, {
                        mode: "no-cors",
                        headers: {
                            'Custom-Header': 'InternetCheck',
                            'X-Purpose': 'Internet-Connectivity-Check'
                        },
                        cache: "no-store",
                        credentials: "omit"
                    })
                    .then(() => {
                        this.uralpro.log("Интернет есть!", `style: color: black; font-weight: bold; background-color: #69667d; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                        resolve(true);
                    })
                    .catch(() => {
                        this.uralpro.log("Проблема с интернетом.", `style: color: red; font-weight: bold; background-color: #69667d; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                        resolve(false);
                    });
            } else {
                this.uralpro.log("navigator.onLine вернул false, интернета нет.", `style: color: red; font-weight: bold; background-color: #69667d; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
                resolve(false);
            }
        });
    }

    onSdkReady(callback) {
        if (!this.uralpro.has('onSdkReady_END')) {
            if (this.uralpro.get('isSdkReadyStop') == "START") {
                if (!this.uralpro.has('platform')) {
                    setTimeout(() => this.onSdkReady(callback), 300);
                } else {
                    if (this.uralpro.get('isSdkReady') && this.uralpro.get('isSdkReadyData')) {
                        if (this.uralpro.get('platform') == "file" || this.uralpro.get('platform') == "android") {
                            callback();
                            this.uralpro.set('onSdkReady_END', 'END');
                        } else {
                            this.checkInternetConnection().then(isOnline => {
                                if (isOnline) {
                                    callback();
                                    this.uralpro.set('onSdkReady_END', 'END');
                                } else {
                                    this.uralpro.error("Нет подключения к интернету. Ожидание подключения...");
                                    setTimeout(() => this.onSdkReady(callback), 1000);
                                }
                            });
                        }
                    } else {
                        setTimeout(() => this.onSdkReady(callback), 1000);
                    }
                }
            } else {
                setTimeout(() => this.onSdkReady(callback), 1000);
            }
        }
    }

    setData(key, value) {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Изменение mapDataSDK из консоли запрещено.");
            return;
        }

        if (Array.isArray(value)) {
            value = JSON.stringify(value);
        }else{
            if (!isNaN(value)) {
                if ((Number(value) % 1) !== 0) {
                   value = parseFloat(value);  
                }else{
                    value = Number(value);
                }
            }
        }

        // Автоматически добавляем новую настройку в save_idArray, если её там нет
        this.autoAddToSaveIdArray(key, value);

        // Сохраняем данные в памяти без сжатия
        // Сжатие будет происходить только при сохранении в saveDataUrgently()
        this.uralpro.get('mapDataApp').set(this.uralpro.save_id000 + key, value);
    }
    hasData(key) {
        return this.uralpro.get('mapDataApp').has(this.uralpro.save_id000 + key);
    }
    getData(key) {
        const value = this.uralpro.get('mapDataApp').get(this.uralpro.save_id000 + key);

        // Автоматически добавляем новую настройку в save_idArray, если её там нет
        if (value !== undefined && value !== null) {
            this.autoAddToSaveIdArray(key, value);
            // Данные в памяти несжатые, возвращаем как есть
            return this.safeJsonParse(value);
        } else {
            // Если значение не найдено, проверяем localStorage напрямую
            const localStorageKey = this.uralpro.save_id000 + key;
            const localStorageValue = localStorage.getItem(localStorageKey);
            if (localStorageValue !== null && !this.isSystemSetting(key)) {
                // Добавляем найденную настройку в save_idArray
                this.autoAddToSaveIdArray(key, localStorageValue);
                
                // Распаковываем данные из localStorage, если они сжаты
                if (typeof localStorageValue === 'string' && localStorageValue.startsWith('COMPRESSED:')) {
                    // Данные сжаты, распаковываем независимо от настроек
                    const decompressed = this.uralpro.decompressData(localStorageValue);
                    const parsedData = this.safeJsonParse(decompressed);
                    
                    // Сохраняем в памяти распакованные данные
                    this.uralpro.get('mapDataApp').set(localStorageKey, parsedData);
                    
                    return parsedData;
                } else {
                    // Данные не сжаты, сохраняем как есть
                    this.uralpro.get('mapDataApp').set(localStorageKey, localStorageValue);
                    return this.safeJsonParse(localStorageValue);
                }
            }
        }

        return value;
    }

    // Безопасный парсинг JSON с обработкой ошибок
    safeJsonParse(value) {
        if (value === null || value === undefined) {
            return value;
        }
        
        // Если это уже объект, возвращаем как есть
        if (typeof value === 'object') {
            return value;
        }
        
        // Если это строка, пытаемся распарсить JSON
        if (typeof value === 'string') {
            const trimmed = value.trim();
            
            // Быстрая проверка
            if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
                (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                
                // Исключаем заведомо не-JSON форматы
                const isLikelyJson = !trimmed.includes('=') && // нет знака равенства
                                    !trimmed.includes('(') && // нет круглых скобок
                                    !trimmed.includes(')') &&
                                    (trimmed.includes('"') || // есть кавычки для строк
                                     trimmed.includes(':') || // есть двоеточия для объектов
                                     trimmed.includes(',') || // есть запятые для разделения
                                     trimmed === '{}' ||      // пустой объект
                                     trimmed === '[]');       // пустой массив
                
                if (isLikelyJson) {
                    try {
                        return JSON.parse(value);
                    } catch (e) {
                        this.uralpro.error(`Ошибка парсинга JSON для значения: ${value.substring(0, 100)}...`, e);
                        return value;
                    }
                }
            }
            
            return value;
        }
        
        return value;
    }
    defsetData(key) {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Изменение mapDataSDK из консоли запрещено.");
            return;
        }
        if (this.uralpro.save_idArray) {
            const data = this.uralpro.save_idArray;
            const value = this.uralpro.getValueByKey(data, key);
            this.uralpro.log(value)
            if (data && value) {
                this.setData(key, value);
                return;
            }
        }
        this.uralpro.warn(key + " - значения по умолчанию не найдено, установка undefined");
        this.setData(key, undefined);
    }

    getType(value) {
        if (value === null) {
            return 'null';
        }
        if (Array.isArray(value)) {
            return 'array';
        }
        const type = typeof value;
        if (type === 'object') {
            return Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
        }
        return type;
    }

    // Автоматическое добавление новых настроек в save_idArray
    autoAddToSaveIdArray(key, value) {
        // Проверяем, есть ли уже такая настройка в save_idArray
        const exists = this.uralpro.save_idArray.some(([existingKey]) => existingKey === key);
        
        if (!exists) {
            // Определяем тип значения для установки правильного значения по умолчанию
            let defaultValue;
            if (typeof value === 'boolean') {
                defaultValue = value.toString();
            } else if (typeof value === 'number') {
                defaultValue = value.toString();
            } else if (typeof value === 'string') {
                defaultValue = value;
            } else if (Array.isArray(value)) {
                defaultValue = JSON.stringify(value);
            } else if (value === null || value === undefined) {
                defaultValue = '';
            } else {
                defaultValue = value.toString();
            }
            
            // Добавляем новую настройку в save_idArray
            this.uralpro.save_idArray.push([key, defaultValue]);
            
            // Логируем добавление новой настройки только если это действительно настройка
            if (this.isUserSetting(key)) {
                this.uralpro.log(`🔧 Автоматически добавлена новая настройка: ${key} = ${defaultValue}`, 
                    `style: color: #2e2727; font-weight: bold; background-color: #b49a11; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
            } else {
                this.uralpro.log(`💾 Автоматически добавлен новый параметр: ${key} = ${defaultValue}`, 
                    `style: color: #2e2727; font-weight: bold; background-color: #4a90e2; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
            }
        }
    }

    // Автоматическое обнаружение настроек из глобальных объектов
    autoDiscoverSettings() {
        // Проверяем, не было ли уже выполнено обнаружение
        if (this.uralpro.get('settingsDiscoveryCompleted')) {
            return;
        }
        
        this.uralpro.set('settingsDiscoveryCompleted', true);
        // Список префиксов для автоматического обнаружения настроек
        const settingPrefixes = ['get', 'is', 'has', 'should'];
        const settingSuffixes = ['Setting', 'Enabled', 'Active', 'Visible', 'Show', 'Hide'];
        
        // Функция для проверки, является ли свойство настройкой
        const isSettingProperty = (name) => {
            const lowerName = name.toLowerCase();
            
            // Проверяем префиксы
            const hasPrefix = settingPrefixes.some(prefix => 
                lowerName.startsWith(prefix.toLowerCase())
            );
            
            // Проверяем суффиксы
            const hasSuffix = settingSuffixes.some(suffix => 
                lowerName.endsWith(suffix.toLowerCase())
            );
            
            // Проверяем наличие слова "setting" в названии
            const hasSetting = lowerName.includes('setting');
            
            return hasPrefix && (hasSuffix || hasSetting);
        };
        
        // Функция для извлечения ключа настройки из названия метода
        const extractSettingKey = (methodName) => {
            let key = methodName;
            
            // Убираем префиксы
            settingPrefixes.forEach(prefix => {
                if (key.toLowerCase().startsWith(prefix.toLowerCase())) {
                    key = key.slice(prefix.length);
                }
            });
            
            // Убираем суффиксы
            settingSuffixes.forEach(suffix => {
                if (key.toLowerCase().endsWith(suffix.toLowerCase())) {
                    key = key.slice(0, -suffix.length);
                }
            });
            
            // Преобразуем в camelCase, если нужно
            if (key.length > 0) {
                key = key.charAt(0).toLowerCase() + key.slice(1);
            }
            
            return key;
        };
        
        // Сканируем глобальные объекты на предмет настроек
        const globalObjects = [window, document];
        const discoveredSettings = new Map();
        
        globalObjects.forEach(obj => {
            if (obj && typeof obj === 'object') {
                Object.getOwnPropertyNames(obj).forEach(propName => {
                    if (isSettingProperty(propName)) {
                        const settingKey = extractSettingKey(propName);
                        if (settingKey && !discoveredSettings.has(settingKey)) {
                            discoveredSettings.set(settingKey, 'false'); // значение по умолчанию
                        }
                    }
                });
            }
        });
        
        // Сканируем прототипы классов на предмет методов настроек
        const classNames = ['GameManager', 'Settings', 'Config', 'Options'];
        classNames.forEach(className => {
            const Class = window[className];
            if (Class && typeof Class === 'function' && Class.prototype) {
                Object.getOwnPropertyNames(Class.prototype).forEach(methodName => {
                    if (isSettingProperty(methodName)) {
                        const settingKey = extractSettingKey(methodName);
                        if (settingKey && !discoveredSettings.has(settingKey)) {
                            discoveredSettings.set(settingKey, 'false');
                        }
                    }
                });
            }
        });
        
        // Добавляем обнаруженные настройки в save_idArray
        discoveredSettings.forEach((defaultValue, key) => {
            this.autoAddToSaveIdArray(key, defaultValue);
        });
        
        if (discoveredSettings.size > 0) {
            this.uralpro.log(`🔍 Автоматически обнаружено ${discoveredSettings.size} настроек`, 
                `style: color: #2e2727; font-weight: bold; background-color: #b49a11; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
        }
    }

    // Публичный метод для ручного запуска обнаружения настроек
    discoverSettings() {
        this.autoDiscoverSettings();
        
        // Отправляем событие о том, что настройки были обновлены
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('uralpro:settingsUpdated', {
                detail: { saveIdArray: this.uralpro.save_idArray }
            }));
        }
    }

    // Новые публичные методы для работы со сжатием
    enableDataCompression(threshold = 100, keys = []) {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Изменение настроек сжатия из консоли запрещено.");
            return;
        }
        
        this.uralpro.config.enableCompression = true;
        this.uralpro.config.compressionThreshold = threshold;
        this.uralpro.config.compressKeys = Array.isArray(keys) ? keys : [];
        
        // Логируем только если включено логирование сжатия
        if (this.uralpro.config.enableCompressionLogging) {
            this.uralpro.log(`Сжатие данных включено. Порог: ${threshold} символов, ключи: ${keys.length > 0 ? keys.join(', ') : 'все'}`, 
                `style: color: #2e2727; font-weight: bold; background-color: #4CAF50; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
        }
    }

    disableDataCompression() {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Изменение настроек сжатия из консоли запрещено.");
            return;
        }
        
        this.uralpro.config.enableCompression = false;
        
        // Логируем только если включено логирование сжатия
        if (this.uralpro.config.enableCompressionLogging) {
            this.uralpro.log("Сжатие данных отключено", 
                `style: color: #2e2727; font-weight: bold; background-color: #f44336; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
        }
    }

    getCompressionStatus() {
        return {
            enabled: this.uralpro.config.enableCompression,
            threshold: this.uralpro.config.compressionThreshold,
            keys: this.uralpro.config.compressKeys,
            loggingEnabled: this.uralpro.config.enableCompressionLogging,
            lzStringAvailable: this.uralpro.isLZStringAvailable()
        };
    }

    // Принудительное сжатие данных (для ручного использования)
    compressDataManually(data) {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Сжатие данных из консоли запрещено.");
            return data;
        }
        
        return this.uralpro.compressData(data);
    }

    // Принудительная распаковка данных (для ручного использования)
    decompressDataManually(data) {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Распаковка данных из консоли запрещено.");
            return data;
        }
        
        return this.uralpro.decompressData(data);
    }

    // Получение сырых данных без распаковки
    getRawData(key) {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Получение данных из консоли запрещено.");
            return null;
        }

        const value = this.uralpro.get('mapDataApp').get(this.uralpro.save_id000 + key);

        if (value !== undefined && value !== null) {
            return value;
        } else {
            // Если значение не найдено, проверяем localStorage напрямую
            const localStorageKey = this.uralpro.save_id000 + key;
            const localStorageValue = localStorage.getItem(localStorageKey);
            if (localStorageValue !== null && !this.isSystemSetting(key)) {
                return localStorageValue;
            }
        }

        return value;
    }

    // Проверка, сжаты ли данные
    isDataCompressed(key) {
        const rawData = this.getRawData(key);
        return typeof rawData === 'string' && rawData.startsWith('COMPRESSED:');
    }

    // Включить логирование операций сжатия
    enableCompressionLogging() {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Изменение настроек логирования из консоли запрещено.");
            return;
        }
        
        this.uralpro.config.enableCompressionLogging = true;
        this.uralpro.log("Логирование сжатия данных включено", 
            `style: color: #2e2727; font-weight: bold; background-color: #4CAF50; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
    }

    // Отключить логирование операций сжатия
    disableCompressionLogging() {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Изменение настроек логирования из консоли запрещено.");
            return;
        }
        
        this.uralpro.config.enableCompressionLogging = false;
        this.uralpro.log("Логирование сжатия данных отключено", 
            `style: color: #2e2727; font-weight: bold; background-color: #f44336; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
    }

    // Включить менеджер сохранений
    enableSaveManager() {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Изменение настроек менеджера сохранений из консоли запрещено.");
            return;
        }
        
        this.uralpro.config.enableSaveManager = true;
        this.uralpro.log("Менеджер сохранений включен", 
            `style: color: #2e2727; font-weight: bold; background-color: #4CAF50; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
    }

    // Отключить менеджер сохранений
    disableSaveManager() {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Изменение настроек менеджера сохранений из консоли запрещено.");
            return;
        }
        
        this.uralpro.config.enableSaveManager = false;
        this.uralpro.log("Менеджер сохранений отключен", 
            `style: color: #2e2727; font-weight: bold; background-color: #f44336; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
    }

    // Показать кнопку менеджера сохранений
    showSaveManagerButton() {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Изменение настроек менеджера сохранений из консоли запрещено.");
            return;
        }
        
        this.uralpro.config.showSaveManagerButton = true;
        this.saveManager.createSaveManagerButton();
        this.uralpro.log("Кнопка менеджера сохранений показана", 
            `style: color: #2e2727; font-weight: bold; background-color: #4CAF50; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
    }

    // Скрыть кнопку менеджера сохранений
    hideSaveManagerButton() {
        if (this.uralpro.isCalledFromConsole()) {
            this.uralpro.error("Изменение настроек менеджера сохранений из консоли запрещено.");
            return;
        }
        
        this.uralpro.config.showSaveManagerButton = false;
        this.saveManager.removeSaveManagerButton();
        this.uralpro.log("Кнопка менеджера сохранений скрыта", 
            `style: color: #2e2727; font-weight: bold; background-color: #f44336; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); `);
    }

    // Получить статус менеджера сохранений
    getSaveManagerStatus() {
        return {
            enabled: this.uralpro.config.enableSaveManager,
            buttonVisible: this.uralpro.config.showSaveManagerButton,
            buttonExists: !!document.getElementById('save-manager-button')
        };
    }

    // Обнаружение настроек из сохраненных данных
    discoverSavedSettings() {
        const discoveredSettings = new Map();
        const discoveredUserSettings = new Map();
        const discoveredGameData = new Map();
        const discoveredParameters = new Map();
        
        if (this.uralpro.get("getPlayer") === "yandex") {
            // Для Яндекс платформы - сканируем mapDataYandexApp
            this.uralpro.get('mapDataYandexApp').forEach((value, key) => {
                // Убираем префикс DataPro из ключа
                const settingKey = key.replace(this.uralpro.save_id000, '');
                
                // Проверяем, что это не системная настройка
                if (!this.isSystemSetting(settingKey)) {
                    // Сохраняем данные как есть (сжатые остаются сжатыми)
                    discoveredSettings.set(settingKey, value);
                    
                    // Классифицируем найденные данные
                    if (this.isUserSetting(settingKey)) {
                        discoveredUserSettings.set(settingKey, value);
                    } else if (this.isGameData(settingKey)) {
                        discoveredGameData.set(settingKey, value);
                    } else {
                        discoveredParameters.set(settingKey, value);
                    }
                }
            });
        } else {
            // Для локального хранилища - сканируем localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.uralpro.save_id000)) {
                    const settingKey = key.replace(this.uralpro.save_id000, '');
                    const value = localStorage.getItem(key);
                    
                    // Проверяем, что это не системная настройка
                    if (!this.isSystemSetting(settingKey)) {
                        // Сохраняем данные как есть (сжатые остаются сжатыми)
                        discoveredSettings.set(settingKey, value);
                        
                        // Классифицируем найденные данные
                        if (this.isUserSetting(settingKey)) {
                            discoveredUserSettings.set(settingKey, value);
                        } else if (this.isGameData(settingKey)) {
                            discoveredGameData.set(settingKey, value);
                        } else {
                            discoveredParameters.set(settingKey, value);
                        }
                    }
                }
            }
        }
        
        // Добавляем обнаруженные настройки в save_idArray
        discoveredSettings.forEach((value, key) => {
            this.autoAddToSaveIdArray(key, value);
        });
        
        // Логируем результаты с разбивкой по типам
        if (discoveredSettings.size > 0) {
            
            // Отправляем событие о том, что настройки были обновлены
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('uralpro:settingsUpdated', {
                    detail: { 
                        saveIdArray: this.uralpro.save_idArray,
                        userSettings: Array.from(discoveredUserSettings.keys()),
                        gameData: Array.from(discoveredGameData.keys()),
                        parameters: Array.from(discoveredParameters.keys())
                    }
                }));
            }
        }
    }

    // Проверка, является ли настройка системной
    isSystemSetting(key) {
        const systemSettings = [
            'ADYAShowADS', 'GameHelp', 'GameSoundSettings', 'GameMusicSettings',
            'ysdk_lastFullscreenAdv', 'ysdkAdvStart', 'iStartBackgroundAudio',
            '____init', 'getPlayer', 'sdk', 'isSdkReadyStop', 'isSdkReady', 'isSdkReadyData',
            'isLoaded', 'isGameReady', 'mapDataYandexApp', 'mapDataApp', 'saveDataOld1', 'saveDataOld2',
            'platform', 'lang', 'setup_saveData', 'onSdkReady_END', 'settingsDiscoveryCompleted'
        ];
        
        return systemSettings.includes(key);
    }

    // Проверка, является ли ключ пользовательской настройкой
    isUserSetting(key) {
        if (!key || typeof key !== 'string') return false;
        
        const lowerKey = key.toLowerCase();
        
        // Список ключевых слов, которые указывают на пользовательскую настройку
        const userSettingKeywords = [
            'setting', 'enabled', 'disabled', 'active', 'inactive',
            'visible', 'hidden', 'show', 'hide', 'display',
            'sound', 'music', 'audio', 'volume', 'mute',
            'theme', 'color', 'background', 'font', 'size',
            'quality', 'performance', 'fps', 'resolution',
            'language', 'lang', 'locale', 'region',
            'notification', 'alert', 'popup', 'modal',
            'auto', 'manual', 'default', 'custom',
            'debug', 'log', 'verbose', 'quiet',
            'save', 'load', 'backup', 'sync',
            'privacy', 'security', 'permission',
            'accessibility', 'screen', 'reader', 'contrast',
            'completed', 'numbers', 'highlight', 'arts',
            'toggle', 'switch', 'option', 'preference'
        ];
        
        // Проверяем наличие ключевых слов пользовательских настроек
        const hasUserSettingKeyword = userSettingKeywords.some(keyword => 
            lowerKey.includes(keyword)
        );
        
        // Проверяем паттерны названий пользовательских настроек
        const userSettingPatterns = [
            /^(is|get|has|should|can|will)[A-Z].*(Enabled|Disabled|Active|Visible|Show|Hide|Setting)$/, // isSoundEnabled, getShowNumbersSetting
            /^(enable|disable|show|hide|toggle)[A-Z]/, // enableSound, toggleTheme
            /[A-Z][a-z]+(Setting|Config|Option|Preference)$/, // userSetting, gameConfig
            /^(hide|show)[A-Z]/, // hideCompleted, showNumbers
        ];
        
        const matchesUserSettingPattern = userSettingPatterns.some(pattern => 
            pattern.test(key)
        );
        
        // Проверяем, что ключ не является системным
        const isSystem = this.isSystemSetting(key);
        
        // Проверяем, что ключ не является данными игры (сохранения, прогресс)
        const isGameData = this.isGameData(key);
        
        return (hasUserSettingKeyword || matchesUserSettingPattern) && !isSystem && !isGameData;
    }

    // Проверка, является ли ключ данными игры
    isGameData(key) {
        if (!key || typeof key !== 'string') return false;
        
        const lowerKey = key.toLowerCase();
        
        // Список ключевых слов, которые указывают на данные игры
        const gameDataKeywords = [
            'save', 'saves', 'progress', 'level', 'score', 'points', 'coins',
            'inventory', 'item', 'weapon', 'armor', 'skill', 'ability',
            'quest', 'mission', 'achievement', 'trophy', 'badge',
            'player', 'character', 'hero', 'avatar', 'stats',
            'map', 'world', 'location', 'position', 'coordinate',
            'art', 'pixel', 'canvas', 'drawing', 'painting',
            'timeline', 'history', 'record', 'log', 'data',
            'state', 'status', 'condition', 'health', 'energy',
            'time', 'date', 'timestamp', 'duration', 'session'
        ];
        
        // Проверяем наличие ключевых слов данных игры
        const hasGameDataKeyword = gameDataKeywords.some(keyword => 
            lowerKey.includes(keyword)
        );
        
        // Проверяем паттерны названий данных игры
        const gameDataPatterns = [
            /^(pixel|game|player|save|progress)[A-Z]/, // pixelArtSaves, gameState
            /[A-Z][a-z]+(Save|Data|State|Progress|Record)$/, // userSave, gameData
            /^(last|current|previous)[A-Z]/, // lastOpened, currentLevel
        ];
        
        const matchesGameDataPattern = gameDataPatterns.some(pattern => 
            pattern.test(key)
        );
        
        return hasGameDataKeyword || matchesGameDataPattern;
    }

    // Менеджер управления сохранениями
    saveManager = {
        // Показ модального окна управления сохранениями
        showSaveManager: () => {
            if (this.uralpro.isCalledFromConsole()) {
                this.uralpro.error("Открытие менеджера сохранений из консоли запрещено.");
                return;
            }

            // Проверяем разрешение на работу с менеджером сохранений
            if (!this.uralpro.config.enableSaveManager) {
                this.uralpro.warn("Менеджер сохранений отключен в настройках.");
                return;
            }

            // Создаем модальное окно
            const modal = document.createElement('div');
            modal.id = 'save-manager-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(5px);
            `;

            // Создаем контент
            const content = document.createElement('div');
            content.style.cssText = `
                background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
                border-radius: 15px;
                padding: 30px;
                max-width: 90vw;
                max-height: 90vh;
                overflow-y: auto;
                border: 2px solid #ffd700;
                box-shadow: 0 0 30px rgba(255, 215, 0, 0.3);
                color: white;
                font-family: Arial, sans-serif;
            `;

            // Заголовок
            const title = document.createElement('h2');
            title.textContent = '💾 Менеджер сохранений';
            title.style.cssText = `
                color: #ffd700;
                margin: 0 0 20px 0;
                text-align: center;
                font-size: 24px;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
            `;

            // Статистика
            const stats = this.saveManager.getSaveStats();
            const statsDiv = document.createElement('div');
            statsDiv.style.cssText = `
                background: rgba(255, 215, 0, 0.1);
                border: 1px solid #ffd700;
                border-radius: 10px;
                padding: 15px;
                margin-bottom: 20px;
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 15px;
            `;

            const statItems = [
                { label: 'Всего сохранений', value: stats.totalSaves, icon: '📊' },
                { label: 'Размер данных', value: stats.totalSize, icon: '💾' },
                { label: 'Платформа', value: stats.platform, icon: '🌐' },
                { label: 'Последнее сохранение', value: stats.lastSave, icon: '⏰' }
            ];

            statItems.forEach(item => {
                const statItem = document.createElement('div');
                statItem.style.cssText = `
                    text-align: center;
                    padding: 10px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                `;
                statItem.innerHTML = `
                    <div style="font-size: 20px; margin-bottom: 5px;">${item.icon}</div>
                    <div style="font-size: 12px; color: #ccc; margin-bottom: 5px;">${item.label}</div>
                    <div style="font-size: 14px; font-weight: bold; color: #ffd700;">${item.value}</div>
                `;
                statsDiv.appendChild(statItem);
            });

            // Список сохранений
            const savesList = document.createElement('div');
            savesList.style.cssText = `
                max-height: 300px;
                overflow-y: auto;
                margin-bottom: 20px;
                border: 1px solid #444;
                border-radius: 10px;
                background: rgba(0, 0, 0, 0.3);
            `;

            const saves = this.saveManager.getAllSaves();
            if (saves.length === 0) {
                const noSaves = document.createElement('div');
                noSaves.style.cssText = `
                    padding: 20px;
                    text-align: center;
                    color: #888;
                    font-style: italic;
                `;
                noSaves.textContent = 'Нет сохранений для отображения';
                savesList.appendChild(noSaves);
            } else {
                saves.forEach((save, index) => {
                    const saveItem = document.createElement('div');
                    saveItem.style.cssText = `
                        padding: 15px;
                        border-bottom: 1px solid #444;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        transition: background 0.3s ease;
                    `;
                    saveItem.onmouseenter = () => {
                        saveItem.style.background = 'rgba(255, 215, 0, 0.1)';
                    };
                    saveItem.onmouseleave = () => {
                        saveItem.style.background = 'transparent';
                    };

                    const saveInfo = document.createElement('div');
                    saveInfo.innerHTML = `
                        <div style="font-weight: bold; color: #ffd700; margin-bottom: 5px;">${save.key}</div>
                        <div style="font-size: 12px; color: #ccc;">${save.type} • ${save.size}</div>
                        <div style="font-size: 11px; color: #888;">${save.value}</div>
                    `;

                    const saveActions = document.createElement('div');
                    saveActions.style.cssText = `
                        display: flex;
                        gap: 10px;
                    `;

                    // Кнопка экспорта
                    const exportBtn = document.createElement('button');
                    exportBtn.textContent = '📤';
                    exportBtn.title = 'Экспортировать';
                    exportBtn.style.cssText = `
                        background: #4CAF50;
                        color: white;
                        border: none;
                        padding: 8px 12px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: background 0.3s ease;
                    `;
                    exportBtn.onclick = () => this.saveManager.exportSave(save.key);

                    // Кнопка удаления
                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = '🗑️';
                    deleteBtn.title = 'Удалить';
                    deleteBtn.style.cssText = `
                        background: #f44336;
                        color: white;
                        border: none;
                        padding: 8px 12px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: background 0.3s ease;
                    `;
                    deleteBtn.onclick = () => this.saveManager.deleteSave(save.key, savesList);

                    saveActions.appendChild(exportBtn);
                    saveActions.appendChild(deleteBtn);
                    saveItem.appendChild(saveInfo);
                    saveItem.appendChild(saveActions);
                    savesList.appendChild(saveItem);
                });
            }

            // Кнопки действий
            const actionsDiv = document.createElement('div');
            actionsDiv.style.cssText = `
                display: flex;
                gap: 15px;
                justify-content: center;
                flex-wrap: wrap;
            `;

            const buttons = [
                {
                    text: '📤 Экспорт всех',
                    action: () => this.saveManager.exportAllSaves(),
                    style: 'background: #2196F3; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: background 0.3s ease;'
                },
                {
                    text: '📥 Импорт',
                    action: () => this.saveManager.importSaves(),
                    style: 'background: #4CAF50; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: background 0.3s ease;'
                },
                {
                    text: '🗑️ Очистить все',
                    action: () => this.saveManager.clearAllSaves(modal),
                    style: 'background: #f44336; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: background 0.3s ease;'
                },
                {
                    text: '❌ Закрыть',
                    action: () => modal.remove(),
                    style: 'background: #666; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: background 0.3s ease;'
                }
            ];

            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.textContent = btn.text;
                button.style.cssText = btn.style;
                button.onclick = btn.action;
                button.onmouseenter = () => {
                    button.style.opacity = '0.8';
                };
                button.onmouseleave = () => {
                    button.style.opacity = '1';
                };
                actionsDiv.appendChild(button);
            });

            // Закрытие по клику вне модала
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            };

            content.appendChild(title);
            content.appendChild(statsDiv);
            content.appendChild(savesList);
            content.appendChild(actionsDiv);
            modal.appendChild(content);
            document.body.appendChild(modal);
        },

        // Получение статистики сохранений
        getSaveStats: () => {
            const saves = this.saveManager.getAllSaves();
            const totalSize = saves.reduce((sum, save) => sum + save.sizeBytes, 0);
            
            return {
                totalSaves: saves.length,
                totalSize: this.saveManager.formatBytes(totalSize),
                platform: this.uralpro.get('platform') || 'unknown',
                lastSave: this.saveManager.getLastSaveTime()
            };
        },

        // Получение всех сохранений
        getAllSaves: () => {
            const saves = [];
            const saveIdArray = this.uralpro.save_idArray || [];
            
            saveIdArray.forEach(([key, defaultValue]) => {
                const value = this.getData(key);
                if (value !== undefined && value !== null) {
                    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
                    const sizeBytes = new Blob([valueStr]).size;
                    
                    saves.push({
                        key: key,
                        value: this.saveManager.truncateValue(valueStr, 50),
                        type: this.saveManager.getDataType(value),
                        size: this.saveManager.formatBytes(sizeBytes),
                        sizeBytes: sizeBytes,
                        rawValue: value
                    });
                }
            });
            
            return saves.sort((a, b) => b.sizeBytes - a.sizeBytes);
        },

        // Форматирование размера в байтах
        formatBytes: (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        // Обрезка значения для отображения
        truncateValue: (value, maxLength) => {
            if (value.length <= maxLength) return value;
            return value.substring(0, maxLength) + '...';
        },

        // Определение типа данных
        getDataType: (value) => {
            if (typeof value === 'number') return 'Number';
            if (typeof value === 'boolean') return 'Boolean';
            if (typeof value === 'string') return 'String';
            if (Array.isArray(value)) return 'Array';
            if (typeof value === 'object') return 'Object';
            return 'Unknown';
        },

        // Получение времени последнего сохранения
        getLastSaveTime: () => {
            const lastSave = localStorage.getItem('uralpro_lastSaveTime');
            if (lastSave) {
                return new Date(parseInt(lastSave)).toLocaleString();
            }
            return 'Неизвестно';
        },

        // Экспорт одного сохранения
        exportSave: (key) => {
            const value = this.getData(key);
            if (value === undefined) {
                this.uralpro.error(`Сохранение "${key}" не найдено`);
                return;
            }

            const exportData = {
                key: key,
                value: value,
                exportTime: new Date().toISOString(),
                platform: this.uralpro.get('platform')
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `uralpro_save_${key}_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.uralpro.log(`Сохранение "${key}" экспортировано`);
        },

        // Экспорт всех сохранений
        exportAllSaves: () => {
            const saves = this.saveManager.getAllSaves();
            const exportData = {
                saves: saves.map(save => ({
                    key: save.key,
                    value: save.rawValue,
                    type: save.type
                })),
                exportTime: new Date().toISOString(),
                platform: this.uralpro.get('platform'),
                totalSaves: saves.length
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `uralpro_all_saves_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.uralpro.log(`Все сохранения экспортированы (${saves.length} шт.)`);
        },

        // Импорт сохранений
        importSaves: () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.style.display = 'none';

            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        this.saveManager.processImportData(data);
                    } catch (error) {
                        this.uralpro.error('Ошибка при импорте файла:', error);
                        alert('Ошибка при импорте файла. Проверьте формат файла.');
                    }
                };
                reader.readAsText(file);
            };

            input.click();
        },

        // Обработка импортированных данных
        processImportData: (data) => {
            let importedCount = 0;
            let skippedCount = 0;

            if (data.saves && Array.isArray(data.saves)) {
                // Импорт всех сохранений
                data.saves.forEach(save => {
                    if (save.key && save.value !== undefined) {
                        this.setData(save.key, save.value);
                        importedCount++;
                    } else {
                        skippedCount++;
                    }
                });
            } else if (data.key && data.value !== undefined) {
                // Импорт одного сохранения
                this.setData(data.key, data.value);
                importedCount++;
            }

            this.saveDataUrgently();
            
            const message = `Импорт завершен!\nИмпортировано: ${importedCount}\nПропущено: ${skippedCount}`;
            alert(message);
            this.uralpro.log(`Импорт сохранений: ${importedCount} импортировано, ${skippedCount} пропущено`);
        },

        // Удаление сохранения
        deleteSave: (key, container) => {
            if (confirm(`Удалить сохранение "${key}"?`)) {
                // Находим значение по умолчанию
                const saveIdArray = this.uralpro.save_idArray || [];
                const defaultEntry = saveIdArray.find(([k]) => k === key);
                const defaultValue = defaultEntry ? defaultEntry[1] : null;
                
                // Удаляем из памяти
                this.uralpro.get('mapDataApp').delete(this.uralpro.save_id000 + key);
                
                // Удаляем из localStorage
                localStorage.removeItem(this.uralpro.save_id000 + key);
                
                // Удаляем из Яндекс хранилища, если это Яндекс платформа
                if (this.uralpro.get("getPlayer") === "yandex") {
                    this.uralpro.get('mapDataYandexApp').delete(this.uralpro.save_id000 + key);
                }
                
                // Восстанавливаем значение по умолчанию
                if (defaultValue !== null) {
                    this.uralpro.get('mapDataApp').set(this.uralpro.save_id000 + key, defaultValue);
                }
                
                this.saveDataUrgently();
                
                // Обновляем список
                container.innerHTML = '';
                const saves = this.saveManager.getAllSaves();
                if (saves.length === 0) {
                    const noSaves = document.createElement('div');
                    noSaves.style.cssText = `
                        padding: 20px;
                        text-align: center;
                        color: #888;
                        font-style: italic;
                    `;
                    noSaves.textContent = 'Нет сохранений для отображения';
                    container.appendChild(noSaves);
                } else {
                    saves.forEach(save => {
                        // Пересоздаем элементы списка с полным функционалом
                        const saveItem = document.createElement('div');
                        saveItem.style.cssText = `
                            padding: 15px;
                            border-bottom: 1px solid #444;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            transition: background 0.3s ease;
                        `;
                        saveItem.onmouseenter = () => {
                            saveItem.style.background = 'rgba(255, 215, 0, 0.1)';
                        };
                        saveItem.onmouseleave = () => {
                            saveItem.style.background = 'transparent';
                        };

                        const saveInfo = document.createElement('div');
                        saveInfo.innerHTML = `
                            <div style="font-weight: bold; color: #ffd700; margin-bottom: 5px;">${save.key}</div>
                            <div style="font-size: 12px; color: #ccc;">${save.type} • ${save.size}</div>
                            <div style="font-size: 11px; color: #888;">${save.value}</div>
                        `;

                        const saveActions = document.createElement('div');
                        saveActions.style.cssText = `
                            display: flex;
                            gap: 10px;
                        `;

                        // Кнопка экспорта
                        const exportBtn = document.createElement('button');
                        exportBtn.textContent = '📤';
                        exportBtn.title = 'Экспортировать';
                        exportBtn.style.cssText = `
                            background: #4CAF50;
                            color: white;
                            border: none;
                            padding: 8px 12px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 14px;
                            transition: background 0.3s ease;
                        `;
                        exportBtn.onclick = () => this.saveManager.exportSave(save.key);

                        // Кнопка удаления
                        const deleteBtn = document.createElement('button');
                        deleteBtn.textContent = '🗑️';
                        deleteBtn.title = 'Удалить';
                        deleteBtn.style.cssText = `
                            background: #f44336;
                            color: white;
                            border: none;
                            padding: 8px 12px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 14px;
                            transition: background 0.3s ease;
                        `;
                        deleteBtn.onclick = () => this.saveManager.deleteSave(save.key, container);

                        saveActions.appendChild(exportBtn);
                        saveActions.appendChild(deleteBtn);
                        saveItem.appendChild(saveInfo);
                        saveItem.appendChild(saveActions);
                        container.appendChild(saveItem);
                    });
                }
                
                this.uralpro.log(`Сохранение "${key}" удалено`);
            }
        },

        // Очистка всех сохранений
        clearAllSaves: (modal) => {
            if (confirm('Удалить ВСЕ сохранения? Это действие нельзя отменить!')) {
                const saveIdArray = this.uralpro.save_idArray || [];
                let deletedCount = 0;
                
                saveIdArray.forEach(([key, defaultValue]) => {
                    // Удаляем из памяти
                    this.uralpro.get('mapDataApp').delete(this.uralpro.save_id000 + key);
                    
                    // Удаляем из localStorage
                    localStorage.removeItem(this.uralpro.save_id000 + key);
                    
                    // Удаляем из Яндекс хранилища, если это Яндекс платформа
                    if (this.uralpro.get("getPlayer") === "yandex") {
                        this.uralpro.get('mapDataYandexApp').delete(this.uralpro.save_id000 + key);
                    }
                    
                    // Восстанавливаем значение по умолчанию
                    this.uralpro.get('mapDataApp').set(this.uralpro.save_id000 + key, defaultValue);
                    
                    deletedCount++;
                });
                
                this.saveDataUrgently();
                modal.remove();
                
                alert(`Удалено ${deletedCount} сохранений`);
                this.uralpro.log(`Очищены все сохранения (${deletedCount} шт.)`);
            }
        },

        // Создание кнопки менеджера сохранений
        createSaveManagerButton: () => {
            if (this.uralpro.isCalledFromConsole()) {
                this.uralpro.error("Создание кнопки менеджера сохранений из консоли запрещено.");
                return;
            }

            // Проверяем разрешение на показ кнопки
            if (!this.uralpro.config.showSaveManagerButton) {
                return;
            }

            // Проверяем, что кнопка еще не создана
            if (document.getElementById('save-manager-button')) {
                return;
            }

            // Создаем кнопку
            const button = document.createElement('button');
            button.id = 'save-manager-button';
            button.innerHTML = '💾';
            button.title = 'Менеджер сохранений';
            button.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #ffd700, #ffed4e);
                color: #8b4513;
                border: none;
                border-radius: 50%;
                font-size: 24px;
                cursor: pointer;
                z-index: 9999;
                box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(10px);
                border: 2px solid rgba(255, 215, 0, 0.5);
            `;

            // Эффекты при наведении
            button.onmouseenter = () => {
                button.style.transform = 'scale(1.1)';
                button.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.5)';
                button.style.background = 'linear-gradient(135deg, #ffed4e, #ffd700)';
            };

            button.onmouseleave = () => {
                button.style.transform = 'scale(1)';
                button.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.3)';
                button.style.background = 'linear-gradient(135deg, #ffd700, #ffed4e)';
            };

            // Обработчик клика
            button.onclick = () => {
                this.saveManager.showSaveManager();
            };

            // Добавляем кнопку на страницу
            document.body.appendChild(button);

            this.uralpro.log("Кнопка менеджера сохранений создана");
        },

        // Удаление кнопки менеджера сохранений
        removeSaveManagerButton: () => {
            const button = document.getElementById('save-manager-button');
            if (button) {
                button.remove();
                this.uralpro.log("Кнопка менеджера сохранений удалена");
            }
        }
    };

    sheetsGoogleApi = {
        // Пример 1: Обновить данные пользователя (перезаписать)
        //sheetsGoogleApi.updateUserData(url, 'Лист1', 'user123', 'Новые данные пользователя');

        // Пример 2: Добавить новую запись (без перезаписи)
        //sheetsGoogleApi.addUserData(url, 'Лист2', 'user456', 'Дополнительные данные');

        // Универсальный метод для GET-отправки
        async sendViaGet(scriptUrl, data) {
            const params = {
                ...data,
                _cacheBust: new Date().getTime()
            };

            const queryString = new URLSearchParams(params).toString();
            const urlWithParams = `${scriptUrl}?${queryString}`;

            try {
                console.log('📤 Отправка GET запроса:', urlWithParams);
                const response = await fetch(urlWithParams);
                
                const result = await response.text();
                try {
                    const jsonResult = JSON.parse(result);
                    console.log('✅ Успех:', jsonResult);
                    return { success: true, data: jsonResult };
                } catch {
                    console.log('✅ Данные отправлены (ответ не JSON):', result);
                    return { success: true, rawResponse: result };
                }
            } catch (error) {
                console.error('❌ Ошибка:', error);
                return { success: false, error: error.message };
            }
        },

        // Основной метод для обновления данных пользователя
        async updateUserData(scriptUrl, sheetName, userLogin, textData) {
            const data = {
                action: 'update_user_data',  // Ключевое действие
                sheetName: sheetName,        // Имя листа в таблице
                userLogin: userLogin,        // Уникальный логин пользователя
                textData: textData,          // Данные для сохранения
                timestamp: new Date().toISOString()
            };
            return await this.sendViaGet(scriptUrl, data);
        },

        // Альтернативный метод для добавления данных (без перезаписи)
        async addUserData(scriptUrl, sheetName, userLogin, textData) {
            const data = {
                action: 'add_user_data',     // Другое действие - добавить, а не обновить
                sheetName: sheetName,
                userLogin: userLogin,
                textData: textData,
                timestamp: new Date().toISOString()
            };
            return await this.sendViaGet(scriptUrl, data);
        },

        // Для обратной совместимости (старый метод)
        async sendScore(scriptUrl, playerName, score, level) {
            const data = {
                action: 'save_score',
                player: playerName,
                score: score,
                level: level,
                timestamp: new Date().toISOString()
            };
            return await this.sendViaGet(scriptUrl, data);
        }
    };

    /**
     * Модуль работы с VK (ВКонтакте) API.
     * Документация: https://dev.vk.com/ru
     * - Определение платформы VK, параметры запуска (Mini Apps).
     * - Вызов методов API (api.vk.com/method/).
     * - Опциональная загрузка VK Open API скрипта.
     */
    vkApi = {
        /** Версия VK API по умолчанию (актуальная: https://dev.vk.com/ru/reference/versions) */
        defaultApiVersion: '5.199',

        /** Токен доступа (устанавливается вручную или после OAuth / виджета авторизации) */
        _accessToken: null,

        /** Ссылка на экземпляр helper (заполняется в конструкторе) */
        _helper: null,

        /** Проверка, что приложение запущено на платформе VK */
        isVKPlatform() {
            return this._helper && this._helper.uralpro.get('platform') === 'vk';
        },

        /** Установить access token для вызовов VK API */
        setAccessToken(token) {
            this._accessToken = token;
        },

        /** Получить текущий access token */
        getAccessToken() {
            return this._accessToken;
        },

        /**
         * Параметры запуска из URL (VK Mini Apps: vk_user_id, vk_app_id, sign и др.).
         * Читает query (search) и hash.
         */
        getLaunchParams() {
            const parse = (str) => {
                if (!str || typeof str !== 'string') return {};
                const params = {};
                str.replace(/^[?#]/, '').split('&').forEach(part => {
                    const [key, value] = part.split('=');
                    if (key && value != null) params[decodeURIComponent(key)] = decodeURIComponent(value);
                });
                return params;
            };
            const fromSearch = parse(window.location.search);
            const fromHash = parse(window.location.hash);
            return { ...fromSearch, ...fromHash };
        },

        /**
         * Показать alert с информацией об авторизации VK:
         * платформа, параметры запуска (Mini App), наличие access_token.
         */
        showAuthAlert() {
            const lines = [];
            lines.push('VK — информация об авторизации');
            lines.push('────────────────────────────');
            const isVK = this.isVKPlatform();
            lines.push('Платформа VK: ' + (isVK ? 'да' : 'нет'));
            lines.push('Access token: ' + (this._accessToken ? 'установлен (' + String(this._accessToken).slice(0, 12) + '…)' : 'не установлен'));
            const params = this.getLaunchParams();
            const vkKeys = Object.keys(params).filter(k => k.startsWith('vk_') || k === 'sign');
            if (vkKeys.length > 0) {
                lines.push('');
                lines.push('Параметры запуска (URL):');
                vkKeys.forEach(k => {
                    const v = params[k];
                    const display = (v && v.length > 40) ? v.slice(0, 20) + '…' + v.slice(-8) : v;
                    lines.push('  ' + k + ': ' + display);
                });
            } else {
                lines.push('');
                lines.push('Параметры запуска: в URL не найдены (не Mini App или локальный запуск).');
            }
            alert(lines.join('\n'));
        },

        /**
         * Вызов метода VK API.
         * @param {string} method - Имя метода (например 'users.get', 'wall.post')
         * @param {Object} params - Параметры метода (без access_token и v)
         * @param {string} [accessToken] - Токен (если не передан, используется установленный через setAccessToken)
         * @param {string} [version] - Версия API (по умолчанию 5.199)
         * @returns {Promise<{response?: any, error?: object}>}
         */
        async callMethod(method, params = {}, accessToken = null, version = null) {
            const token = accessToken || this._accessToken;
            if (!token) {
                if (this._helper) this._helper.uralpro.error('VK API: не указан access_token. Используйте vkApi.setAccessToken(token) или передайте третьим аргументом.');
                return { error: { error_msg: 'access_token required' } };
            }
            const v = version || this.defaultApiVersion;
            const body = { ...params, access_token: token, v };
            const query = new URLSearchParams(body).toString();
            const url = `https://api.vk.com/method/${method}?${query}`;

            try {
                const response = await fetch(url);
                const data = await response.json();
                if (data.error) {
                    if (this._helper) this._helper.uralpro.error('VK API error:', data.error);
                    return { error: data.error };
                }
                return { response: data.response };
            } catch (err) {
                if (this._helper) this._helper.uralpro.error('VK API request failed:', err);
                return { error: { error_msg: String(err.message) } };
            }
        },

        /**
         * Загрузить VK Open API скрипт и инициализировать VK.
         * После загрузки доступен глобальный объект VK (если скрипт его предоставляет).
         * @param {number} appId - ID приложения VK
         * @param {function} [onReady] - Колбэк после инициализации (получает результат VK.init)
         */
        initSDK(appId, onReady) {
            if (typeof appId !== 'number' && typeof appId !== 'string') {
                if (this._helper) this._helper.uralpro.error('VK initSDK: укажите appId приложения VK.');
                return;
            }
            const helper = this._helper;
            if (!helper || !helper.scriptManager) return;
            const scriptUrl = 'https://vk.com/js/api/openapi.js?169';
            helper.scriptManager.loadJS(scriptUrl, () => {
                if (typeof VK !== 'undefined' && VK.init) {
                    VK.init({ apiId: Number(appId) });
                    if (typeof onReady === 'function') onReady(true);
                } else {
                    if (helper) helper.uralpro.warn('VK Open API скрипт загружен, но VK.init не найден. Используйте vkApi.callMethod с access_token.');
                    if (typeof onReady === 'function') onReady(false);
                }
            });
        }
    };
}