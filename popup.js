document.addEventListener('DOMContentLoaded', () => {
    const safeGet = (id) => document.getElementById(id);
    
    // UI Elements with Safe Access
    const els = {
        tabs: document.querySelectorAll('.tab'),
        tabContents: document.querySelectorAll('.tab-content'),
        wordsInput: safeGet('words'),
        trapWordsInput: safeGet('trapWords'),
        highlightBtn: safeGet('highlightBtn'),
        clearBtn: safeGet('clearBtn'),
        addTrapBtn: safeGet('addTrapBtn'),
        clearTrapsBtn: safeGet('clearTrapsBtn'),
        trapList: safeGet('trapList'),
        matchMode: safeGet('matchMode'),
        scopeSel: safeGet('scope'),
        mainColor: safeGet('mainColor'), // Legacy support or primary
        paletteContainer: safeGet('paletteContainer'),
        addColorBtn: safeGet('addColorBtn'),
        colorPicker: safeGet('colorPicker'),
        rainbowToggle: safeGet('rainbowToggle'),
        glowToggle: safeGet('glowToggle'),
        themeToggle: safeGet('themeToggle'),
        historyList: safeGet('historyList'),
        caseToggle: safeGet('caseToggle'),
        stealthMode: safeGet('stealthMode'),
        floatingToggle: safeGet('floatingToggle'),
        antiDetection: safeGet('antiDetection'),
        tqToggle: safeGet('tqToggle'),
        tqGear: safeGet('tqGear'),
        tqOverlay: safeGet('tqSettingsOverlay'),
        closeTQ: safeGet('closeTQSettings'),
        tqAlertToggle: safeGet('tqAlertToggle'),
        tqFastScan: safeGet('tqFastScan'),
        tqDeepScan: safeGet('tqDeepScan')
    };

    let currentTraps = [];
    let colorPalette = ['#ff75a0', '#7e57c2', '#ff5722', '#4db6ac'];
    let searchHistory = [];
    let currentTheme = 'dark';

    if (els.tqGear) els.tqGear.onclick = () => els.tqOverlay.style.display = 'flex';
    if (els.closeTQ) els.closeTQ.onclick = () => els.tqOverlay.style.display = 'none';

    // Tab Switching Logic - Bulletproof
    if (els.tabs.length > 0) {
        els.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = tab.getAttribute('data-tab');
                const targetContent = safeGet(targetId);
                
                if (targetContent) {
                    // Remove active from all
                    els.tabs.forEach(t => t.classList.remove('active'));
                    els.tabContents.forEach(c => c.classList.remove('active'));
                    
                    // Add active to current
                    tab.classList.add('active');
                    targetContent.classList.add('active');
                }
            });
        });
    }

    // Load State
    chrome.storage.sync.get(['mfp_last_search', 'mfp_traps', 'mfp_settings'], (data) => {
        if (chrome.runtime.lastError) return;

        if (data.mfp_last_search && els.wordsInput) {
            els.wordsInput.value = data.mfp_last_search.words.join(', ');
            if (els.matchMode) els.matchMode.value = data.mfp_last_search.options.matchMode || 'exact';
            if (els.scopeSel) els.scopeSel.value = data.mfp_last_search.options.scope || 'text';
        }
        
        currentTraps = data.mfp_traps || [];
        renderTraps();

        if (data.mfp_settings) {
            const s = data.mfp_settings;
            if (els.mainColor) els.mainColor.value = s.mainColor || '#ff75a0';
            colorPalette = s.colorPalette || ['#ff75a0', '#7e57c2', '#ff5722', '#4db6ac'];
            renderPalette();
            
            if (els.rainbowToggle) els.rainbowToggle.checked = s.rainbowToggle !== false;
            if (els.caseToggle) els.caseToggle.checked = s.caseToggle === true;
            
            searchHistory = s.searchHistory || [];
            renderHistory();

            currentTheme = s.theme || 'dark';
            applyTheme();

            if (els.glowToggle) els.glowToggle.checked = s.glowToggle !== false;
            if (els.stealthMode) els.stealthMode.checked = s.stealthMode !== false;
            if (els.floatingToggle) els.floatingToggle.checked = s.floatingToggle !== false;
            if (els.antiDetection) els.antiDetection.checked = s.antiDetection !== false;
            if (els.tqToggle) els.tqToggle.checked = s.tqToggle !== false;
            if (els.tqAlertToggle) els.tqAlertToggle.checked = s.tqAlertToggle !== false;
            if (els.tqFastScan) els.tqFastScan.checked = s.tqFastScan !== false;
            if (els.tqDeepScan) els.tqDeepScan.checked = s.tqDeepScan !== false;
        }
    });

    function renderPalette() {
        if (!els.paletteContainer) return;
        const chips = els.paletteContainer.querySelectorAll('.color-chip');
        chips.forEach(c => c.remove());
        
        colorPalette.forEach((color, idx) => {
            const chip = document.createElement('div');
            chip.className = 'color-chip';
            if (color === colorPalette[0]) chip.classList.add('active');
            chip.style.backgroundColor = color;
            chip.innerHTML = `<span class="remove-color">&times;</span>`;
            
            chip.onclick = (e) => {
                if (e.target.className === 'remove-color') {
                    if (colorPalette.length > 1) {
                        colorPalette.splice(idx, 1);
                        renderPalette();
                        saveSettings();
                    }
                } else {
                    // Set as primary
                    const first = colorPalette.splice(idx, 1)[0];
                    colorPalette.unshift(first);
                    renderPalette();
                    saveSettings();
                }
            };
            els.paletteContainer.insertBefore(chip, els.addColorBtn);
        });
    }

    if (els.addColorBtn) {
        els.addColorBtn.onclick = () => els.colorPicker.click();
    }
    if (els.colorPicker) {
        els.colorPicker.onchange = (e) => {
            const color = e.target.value;
            if (!colorPalette.includes(color)) {
                colorPalette.push(color);
                renderPalette();
                saveSettings();
            }
        };
    }

    if (els.themeToggle) {
        els.themeToggle.onclick = () => {
            currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme();
            saveSettings();
        };
    }

    function applyTheme() {
        if (currentTheme === 'light') {
            document.body.classList.add('light-mode');
            if (els.themeToggle) els.themeToggle.innerText = '🌞';
        } else {
            document.body.classList.remove('light-mode');
            if (els.themeToggle) els.themeToggle.innerText = '🌙';
        }
    }

    function renderHistory() {
        if (!els.historyList) return;
        els.historyList.innerHTML = '';
        searchHistory.slice(0, 8).forEach(term => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerText = term;
            item.onclick = () => {
                if (els.wordsInput) {
                    els.wordsInput.value = term;
                    els.highlightBtn.click();
                }
            };
            els.historyList.appendChild(item);
        });
    }

    let saveTimeout;
    function saveSettings() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const settings = {
                mainColor: colorPalette[0] || '#ff75a0',
                colorPalette: colorPalette,
                rainbowToggle: els.rainbowToggle ? els.rainbowToggle.checked : true,
                caseToggle: els.caseToggle ? els.caseToggle.checked : false,
                searchHistory: searchHistory,
                theme: currentTheme,
                glowToggle: els.glowToggle ? els.glowToggle.checked : true,
                stealthMode: els.stealthMode ? els.stealthMode.checked : true,
                floatingToggle: els.floatingToggle ? els.floatingToggle.checked : true,
                tqToggle: els.tqToggle ? els.tqToggle.checked : true,
                tqAlertToggle: els.tqAlertToggle ? els.tqAlertToggle.checked : true,
                tqFastScan: els.tqFastScan ? els.tqFastScan.checked : true,
                tqDeepScan: els.tqDeepScan ? els.tqDeepScan.checked : true,
                antiDetection: els.antiDetection ? els.antiDetection.checked : true
            };
            chrome.storage.sync.set({ mfp_settings: settings });
            sendMessage({ action: 'updateSettings', settings });
        }, 300);
    }

    // Attach Listeners
    [els.rainbowToggle, els.caseToggle, els.glowToggle, els.stealthMode, els.floatingToggle, els.antiDetection, els.tqToggle, els.tqAlertToggle, els.tqFastScan, els.tqDeepScan].forEach(el => {
        if (el) el.addEventListener('change', saveSettings);
    });

    if (els.highlightBtn) {
        els.highlightBtn.addEventListener('click', () => {
            if (!els.wordsInput) return;
            const raw = els.wordsInput.value;
            const words = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
            if (words.length > 0 && !searchHistory.includes(raw)) {
                searchHistory.unshift(raw);
                if (searchHistory.length > 20) searchHistory.pop();
                renderHistory();
                saveSettings();
            }
            const options = { 
                matchMode: els.matchMode ? els.matchMode.value : 'exact', 
                scope: els.scopeSel ? els.scopeSel.value : 'text',
                caseSensitive: els.caseToggle ? els.caseToggle.checked : false
            };
            chrome.storage.sync.set({ mfp_last_search: { words, options } });
            sendMessage({ action: 'highlight', words, options });
        });
    }

    // CLEAR RESULTS BUTTON - Fixed searching and clearing
    if (els.clearBtn) {
        els.clearBtn.addEventListener('click', () => {
            if (els.wordsInput) els.wordsInput.value = ''; // Clear text field
            chrome.storage.sync.remove('mfp_last_search'); // Clear saved search
            sendMessage({ action: 'clear' }); // Notify content script
        });
    }

    if (els.clearTrapsBtn) {
        els.clearTrapsBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all traps?')) {
                currentTraps = [];
                renderTraps();
                saveTraps();
            }
        });
    }

    if (els.addTrapBtn) {
        els.addTrapBtn.addEventListener('click', () => {
            if (!els.trapWordsInput) return;
            const val = els.trapWordsInput.value.trim();
            if (val) {
                if (currentTraps.includes(val)) {
                    alert('Pattern already exists');
                } else {
                    currentTraps.push(val);
                    renderTraps();
                    saveTraps();
                    els.trapWordsInput.value = '';
                }
            }
        });
    }

    const syncMd = safeGet('syncMd');
    if (syncMd) {
        syncMd.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                // Parse MD: Find lines starting with - or * and clean them
                const lines = text.split('\n');
                let addedCount = 0;
                lines.forEach(line => {
                    const match = line.match(/^[-*]\s*(?:["'])(.+)(?:["'])/) || line.match(/^[-*]\s*(.+)/);
                    if (match) {
                        const pattern = match[1].trim();
                        if (pattern && !currentTraps.includes(pattern)) {
                            currentTraps.push(pattern);
                            addedCount++;
                        }
                    }
                });
                if (addedCount > 0) {
                    renderTraps();
                    saveTraps();
                    alert(`Successfully synced ${addedCount} patterns!`);
                    // PRO: Trigger instant scan after sync
                    sendMessage({ action: 'highlight' }); 
                } else {
                    alert('No new patterns found in the file.');
                }
                syncMd.value = ''; // Reset
            };
            reader.readAsText(file);
        });
    }

    const accentColors = [
        'rgba(255, 117, 160, 0.15)', // Pink
        'rgba(126, 87, 194, 0.15)',  // Purple
        'rgba(255, 87, 34, 0.15)',   // Orange
        'rgba(77, 182, 172, 0.15)',  // Teal
        'rgba(255, 183, 77, 0.15)',  // Amber
        'rgba(100, 181, 246, 0.15)', // Light Blue
        'rgba(129, 199, 132, 0.15)', // Light Green
        'rgba(240, 98, 146, 0.15)'   // Rose
    ];

    function renderTraps() {
        if (!els.trapList) return;
        els.trapList.innerHTML = '';
        currentTraps.forEach((trap, index) => {
            const div = document.createElement('div');
            div.className = 'trap-item';
            const randomColor = accentColors[index % accentColors.length];
            div.style = `background:${randomColor}; padding:10px; border-radius:12px; margin-bottom:8px; font-size:11px; display:flex; justify-content:space-between; align-items:center; border: 1px solid rgba(255,255,255,0.05); transition: 0.2s;`;
            
            div.onmouseenter = () => { div.style.transform = 'translateX(5px)'; div.style.borderColor = 'rgba(255,255,255,0.1)'; };
            div.onmouseleave = () => { div.style.transform = 'translateX(0)'; div.style.borderColor = 'rgba(255,255,255,0.05)'; };

            const trapSpan = document.createElement('span');
            trapSpan.style.flex = '1';
            trapSpan.style.overflow = 'hidden';
            trapSpan.style.textOverflow = 'ellipsis';
            trapSpan.style.color = '#fff';
            trapSpan.style.fontWeight = '500';
            trapSpan.textContent = trap;

            const delBtn = document.createElement('button');
            delBtn.style.border = 'none';
            delBtn.style.background = 'none';
            delBtn.style.color = 'var(--accent-main)';
            delBtn.style.cursor = 'pointer';
            delBtn.style.fontWeight = '900';
            delBtn.style.padding = '4px';
            delBtn.style.fontSize = '16px';
            delBtn.innerHTML = '&times;';
            delBtn.onclick = () => {
                currentTraps.splice(index, 1);
                renderTraps();
                saveTraps();
            };

            div.appendChild(trapSpan);
            div.appendChild(delBtn);
            els.trapList.appendChild(div);
        });
    }

    function saveTraps() {
        chrome.storage.sync.set({ mfp_traps: currentTraps });
        sendMessage({ action: 'updateTraps', traps: currentTraps });
    }

    function sendMessage(msg) {
        try {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (chrome.runtime.lastError || !tabs || !tabs[0] || !tabs[0].id) return;
                
                chrome.tabs.sendMessage(tabs[0].id, msg, (response) => {
                    if (chrome.runtime.lastError) {
                        const tabId = tabs[0].id;
                        chrome.scripting.executeScript({ 
                            target: { tabId: tabId }, 
                            files: ['content.js'] 
                        }, () => {
                            if (chrome.runtime.lastError) return;
                            chrome.tabs.sendMessage(tabId, msg, () => {});
                        });
                    }
                });
            });
        } catch (e) { console.error("Message error:", e); }
    }
});
