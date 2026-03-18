let foundResults = {};
let trapResults = {};
let shadowRoot;
let currentHighlightIdx = {};
let isDismissed = false;

const sessionPrefix = 'mfp-' + Math.random().toString(36).substring(7);
const rootId = 'sys-' + Math.random().toString(36).substring(7);
const highlightClass = sessionPrefix + '-hl';
const trapClass = sessionPrefix + '-tr';
const alertId = 'tq-alert-' + Math.random().toString(36).substring(7);
const tooltipId = 'hl-tip-' + Math.random().toString(36).substring(7);
const dataAttr = 'data-' + Math.random().toString(36).substring(5);
const countAttr = 'cnt-' + Math.random().toString(36).substring(5);

const smartTrapPatterns = [];

function init() {
    const oldRoots = document.querySelectorAll('[id^="sys-"]');
    oldRoots.forEach(r => r.remove());

    const container = document.createElement('div');
    container.id = rootId;
    if (document.body) {
        document.body.appendChild(container);
    } else {
        document.documentElement.appendChild(container);
    }
    
    try {
        shadowRoot = container.attachShadow({ mode: 'open' });
        setupUI();
    } catch(e) {}
    
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        if (req.action === 'toggleFloatingWindow') {
            const p = shadowRoot && shadowRoot.getElementById('panel');
            if(p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
        }
        else if (req.action === 'highlight') performHighlighting(req.words, req.options);
        else if (req.action === 'updateTraps') autoScanTraps();
        else if (req.action === 'clear') clearAll();
        else if (req.action === 'highlightReset' || req.action === 'reHighlightPage') loadSession();
        else if (req.action === 'addWordFromContext') {
            chrome.storage.sync.get(['mfp_last_search'], d => {
                let lastSearch = d.mfp_last_search || { words: [], options: { matchMode: 'exact', scope: 'text' } };
                if (!lastSearch.words.includes(req.word)) {
                    lastSearch.words.push(req.word);
                    chrome.storage.sync.set({ mfp_last_search: lastSearch }, () => {
                        performHighlighting(lastSearch.words, lastSearch.options);
                    });
                }
            });
        }
        
        if (sendResponse) sendResponse({status: 'ok'});
        return true; 
    });

    loadSession();
    
    const runScan = () => {
        autoScanTraps();
        const nextDelay = 5000 + Math.random() * 5000;
        setTimeout(runScan, nextDelay);
    };
    runScan();
}

function setupUI() {
    if(!shadowRoot) return;
    const style = document.createElement('style');
    style.textContent = `
        :host { all: initial; }
        #panel {
            position: fixed; top: 30px; right: 30px; width: 380px;
            background: rgba(10, 10, 18, 0.98);
            border-radius: 24px; box-shadow: 0 15px 60px rgba(0,0,0,0.8);
            color: #d1d1ff; font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            z-index: 2147483647; overflow: hidden; display: none;
            backdrop-filter: blur(25px); border: 2.5px solid #ff75a033;
        }
        #header { padding: 12px 18px; background: rgba(255,117,160,0.08); cursor: move; display: flex; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .logo { font-weight: 800; font-size: 13px; color: #ff75a0; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 1px; flex-shrink: 0; }
        .logo img { width: 18px; height: 18px; border-radius: 4px; }
        .clear-btn { background: #ff5722; color: #fff; border: none; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 10px; font-weight: 900; transition: 0.2s; margin-left: auto; margin-right: 12px; box-shadow: 0 2px 8px rgba(255,87,34,0.3); }
        .clear-btn:hover { background: #f4511e; transform: scale(1.05); }
        .close { cursor: pointer; font-size: 20px; color: #ff75a0; opacity: 0.8; transition: 0.2s; line-height: 1; }
        .tab-badge { background: #ff5722; color: #fff; padding: 2px 8px; border-radius: 6px; font-size: 9px; margin-right: 10px; vertical-align: middle; }
        .trap-card, .res-card {
            padding: 12px; margin: 8px 12px; border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.05);
            transition: 0.2s ease; display: flex; align-items: center; justify-content: space-between;
            font-size: 12px; font-weight: 500;
        }
        .trap-card:hover, .res-card:hover { transform: translateX(5px); border-color: rgba(255,255,255,0.1); }
        .nav-btns { display: flex; gap: 4px; }
        .nav-btn { background: rgba(255,255,255,0.1); border: none; color: #fff; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
        .nav-btn:hover { background: #ff75a0; }
    `;
    shadowRoot.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'panel';
    panel.innerHTML = `
        <div id="header">
            <span class="logo"><img src="${chrome.runtime.getURL('icons/icon.png')}"> Text Multi-Finder</span>
            <button class="clear-btn" id="clearAll">CLEAR</button>
            <span class="close" id="close">&times;</span>
        </div>
        <div id="body">
            <div id="trap-box"></div>
            <div id="hl-list"></div>
        </div>
        <div id="footer-credit" style="padding: 10px 18px; background: rgba(0,0,0,0.3); border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
            <span style="opacity: 0.6;">Stealth Engine Active</span>
            <a href="https://buymeacoffee.com/antukst" target="_blank" style="color: #ff75a0; text-decoration: none; font-weight: 800; display: flex; align-items: center; gap: 4px;">
                <span>☕</span> BUY ME A COFFEE
            </a>
        </div>
    `;
    shadowRoot.appendChild(panel);
    
    const cb = shadowRoot.getElementById('close');
    if(cb) cb.onclick = () => {
        panel.style.display = 'none';
        isDismissed = true;
        // Save dismissal state for current URL to persist after reload
        const pageKey = 'mfp_dismissed_' + btoa(window.location.href.split('?')[0]);
        chrome.storage.local.set({ [pageKey]: true });
    };

    const cBtn = shadowRoot.getElementById('clearAll');
    if(cBtn) cBtn.onclick = () => clearAll();

    setupDraggable(panel);
}

function setupDraggable(el) {
    if(!shadowRoot) return;
    const header = shadowRoot.getElementById('header');
    if (!header) return;
    let p1=0, p2=0, p3=0, p4=0;
    header.onmousedown = e => {
        p3=e.clientX; p4=e.clientY;
        document.onmouseup = () => { document.onmouseup=null; document.onmousemove=null; };
        document.onmousemove = e => {
            p1=p3-e.clientX; p2=p4-e.clientY; p3=e.clientX; p4=e.clientY;
            el.style.top = (el.offsetTop-p2)+"px"; el.style.left=(el.offsetLeft-p1)+"px";
        };
    };
}

function autoScanTraps() {
    chrome.storage.sync.get(['mfp_traps', 'mfp_settings'], d => {
        if (chrome.runtime.lastError) return;
        const settings = d.mfp_settings || {};
        if (settings.tqToggle === false) {
            updateFloatingUI();
            return;
        }

        const userTraps = d.mfp_traps || [];
        const builtInTraps = ['Attention', 'Trap Detected', 'Quality Check', 'Verification Pattern'];
        const allTraps = Array.from(new Set([...userTraps, ...builtInTraps]));

        // Scan all traps in one go
        highlightEngine(allTraps, { matchMode: 'similar' }, settings, 'trap');

        // PRO: Critical Trap Question Alert
        if (settings.tqAlertToggle !== false) {
            const tqCount = highlightEngine(["Trap Question"], { matchMode: 'similar' }, settings, 'critical');
            if (tqCount > 0) showCriticalAlert();
        }

        updateFloatingUI();
    });
}


/**
 * Efficiently highlights multiple terms in a single DOM pass.
 * @param {Array} wordsList - List of keywords or trap phrases.
 * @param {Object} options - { matchMode, caseSensitive, scope }
 * @param {Object} settings - User settings (colors, rainbowToggle, etc)
 * @param {string} type - 'normal', 'trap', or 'critical'
 */
function highlightEngine(wordsList, options, settings, type) {
    if (!wordsList || wordsList.length === 0) return 0;
    
    let totalCount = 0;
    const matchMode = options.matchMode || 'exact';
    const scope = options.scope || 'text';
    const isCase = options.caseSensitive === true;
    const useRainbow = settings.rainbowToggle !== false;
    const palette = settings.colorPalette || ["#ff75a0", "#7e57c2", "#4db6ac", "#ffb74d"];

    // Build consolidated regex for all words
    const patterns = wordsList.map(text => {
        let p = escapeRegExp(text);
        if (matchMode === 'exact') {
            if (/^\w+$/.test(text)) p = `\\b${p}\\b`;
            else p = `(^|[^a-zA-Z0-9])(${p})(?=[^a-zA-Z0-9]|$)`;
        }
        return `(?<group_${wordsList.indexOf(text)}>${p})`;
    });

    const masterRegex = new RegExp(patterns.join('|'), isCase ? 'g' : 'gi');

    try {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent || parent.closest('script, style, [id^="sys-"], noscript, iframe')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const nodes = [];
        let currentNode;
        while (currentNode = walker.nextNode()) nodes.push(currentNode);

        nodes.forEach(node => {
            const content = node.textContent;
            if (!content || !masterRegex.test(content)) return;
            masterRegex.lastIndex = 0; // Reset for full scan

            if (type === 'trap' || type === 'critical' || scope === 'line') {
                // Element-level highlighting (Trap or Line scope)
                let match;
                while ((match = masterRegex.exec(content)) !== null) {
                    const matchedText = match[0];
                    const wordIdx = Object.keys(match.groups).find(key => match.groups[key] !== undefined).split('_')[1];
                    const originalWord = wordsList[wordIdx];
                    
                    const target = node.parentElement.closest('p, div, li, tr, article, section, td, th, h1, h2, h3, h4, h5, h6') || node.parentElement;
                    if (target) {
                        applyElementHighlight(target, originalWord, type, settings, palette[wordIdx % palette.length]);
                        totalCount++;
                    }
                    if (masterRegex.lastIndex === match.index) masterRegex.lastIndex++;
                }
            } else {
                // Fragment-level highlighting (Normal Span)
                const frag = document.createDocumentFragment();
                let lastIdx = 0;
                let match;
                while ((match = masterRegex.exec(content)) !== null) {
                    const matchedText = match[0];
                    const wordIdx = Object.keys(match.groups).find(key => match.groups[key] !== undefined).split('_')[1];
                    const originalWord = wordsList[wordIdx];
                    const color = useRainbow ? palette[wordIdx % palette.length] : palette[0];

                    // Handle exact match boundaries if symbols are involved
                    let finalMatchText = matchedText;
                    let offsetShift = 0;
                    if (matchMode === 'exact' && !/^\w+$/.test(originalWord)) {
                        // Group structure: [0] full, [1] boundary, [2] word
                        const actualWordMatch = match.groups[`group_${wordIdx}`]; 
                        // Note: capturing groups within named groups can be tricky, fallback to simple match if complex
                        // For simplicity in this refactor, we assume the named group captured the whole thing including boundaries if needed
                    }

                    frag.appendChild(document.createTextNode(content.substring(lastIdx, match.index)));
                    
                    const span = document.createElement('span');
                    span.className = highlightClass;
                    span.style.backgroundColor = color;
                    span.style.color = "#000";
                    span.style.borderRadius = '4px';
                    span.style.padding = '1px 3px';
                    span.setAttribute(dataAttr, originalWord);
                    span.textContent = matchedText;
                    
                    frag.appendChild(span);
                    lastIdx = masterRegex.lastIndex;
                    totalCount++;
                    
                    // Track results for dashboard
                    if (!foundResults[originalWord]) foundResults[originalWord] = { count: 0, color: color };
                    foundResults[originalWord].count++;

                    if (masterRegex.lastIndex === match.index) masterRegex.lastIndex++;
                }
                frag.appendChild(document.createTextNode(content.substring(lastIdx)));
                if (node.parentNode) node.parentNode.replaceChild(frag, node);
            }
        });
    } catch(e) { console.error("MFP Engine Error:", e); }
    return totalCount;
}

function applyElementHighlight(el, word, type, settings, color) {
    if (type === 'trap') {
        el.style.boxShadow = `inset 4px 0 0 ${color || "#f44336"}`;
        el.style.backgroundColor = (color || "#f44336") + "08";
        el.classList.add(trapClass);
        el.setAttribute(dataAttr, word);
        if (!trapResults[word]) trapResults[word] = 0;
        trapResults[word]++;
    } else if (type === 'critical') {
        el.style.outline = "4px solid #ff1744";
        el.style.outlineOffset = "-4px";
        el.style.backgroundColor = "rgba(255, 23, 68, 0.1)";
        el.classList.add(trapClass);
        el.setAttribute(dataAttr, word);
    } else if (type === 'normal') {
        el.style.boxShadow = `inset 4px 0 0 ${color}`;
        el.style.backgroundColor = color + "10";
        el.classList.add(highlightClass);
        el.setAttribute(dataAttr, word);
        el.addEventListener('mouseenter', showTooltip);
        el.addEventListener('mouseleave', hideTooltip);
    }
}


function updateFloatingUI() {
    if (!shadowRoot) return;
    const list = shadowRoot.getElementById('hl-list');
    const trapBox = shadowRoot.getElementById('trap-box');
    const p = shadowRoot.getElementById('panel');
    if (!list || !trapBox || !p) return;
    
    list.innerHTML = ''; trapBox.innerHTML = '';

    const trapTypes = Object.keys(trapResults);
    const foundKeywords = Object.keys(foundResults);

    const resAccentColors = [
        'rgba(255, 117, 160, 0.12)',
        'rgba(126, 87, 194, 0.12)',
        'rgba(77, 182, 172, 0.12)',
        'rgba(255, 183, 77, 0.12)'
    ];

    if (trapTypes.length > 0 || foundKeywords.length > 0) {
        if (trapTypes.length > 0) {
            trapTypes.forEach((t, i) => {
                const d = document.createElement('div');
                d.className = 'trap-card';
                d.style.background = resAccentColors[i % resAccentColors.length];
                
                const span = document.createElement('span');
                const badge = document.createElement('span');
                badge.className = 'tab-badge';
                badge.textContent = 'ATTENTION';
                span.appendChild(badge);
                span.appendChild(document.createTextNode(` ${t} (${trapResults[t]})`));
                
                d.appendChild(span);
                trapBox.appendChild(d);
            });
        }
        
        // ONLY SHOW PANEL IF "Trap Question" IS FOUND
        const hasTrapQuestion = trapResults["Trap Question"] > 0;
        
        if (!isDismissed && hasTrapQuestion) {
            const pageKey = 'mfp_dismissed_' + btoa(window.location.href.split('?')[0]);
            chrome.storage.local.get([pageKey], (data) => {
                if (!data[pageKey]) p.style.display = 'block';
                else p.style.display = 'none';
            });
        } else if (!hasTrapQuestion) {
            p.style.display = 'none';
        }
    } else {
        p.style.display = 'none'; 
    }

    foundKeywords.forEach((w, i) => {
        const r = foundResults[w];
        const d = document.createElement('div');
        d.className = 'res-card';
        d.style.background = resAccentColors[(i + 2) % resAccentColors.length];
        
        const infoSpan = document.createElement('span');
        infoSpan.textContent = `${w} (${r.count})`;
        
        const navDiv = document.createElement('div');
        navDiv.className = 'nav-btns';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = 'nav-btn prev';
        prevBtn.innerHTML = '&larr;';
        prevBtn.onclick = () => navigate(w, -1);
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'nav-btn next';
        nextBtn.innerHTML = '&rarr;';
        nextBtn.onclick = () => navigate(w, 1);
        
        navDiv.appendChild(prevBtn);
        navDiv.appendChild(nextBtn);
        
        d.appendChild(infoSpan);
        d.appendChild(navDiv);
        list.appendChild(d);
    });
}

function performHighlighting(words, options) {
    chrome.storage.sync.get(['mfp_settings'], d => {
        if (chrome.runtime.lastError) return;
        const settings = d.mfp_settings || {};
        clearNormal();
        foundResults = {};
        
        highlightEngine(words, options, settings, 'normal');
        
        updateFloatingUI();
        autoScanTraps();
    });
}

function clearNormal() {
    document.querySelectorAll(`.${highlightClass}, .${trapClass}`).forEach(el => {
        if (el.tagName === 'SPAN') {
            el.replaceWith(document.createTextNode(el.innerText));
        } else {
            el.style.backgroundColor = "";
            el.style.border = "";
            el.style.borderLeft = "";
            el.classList.remove(highlightClass);
            el.classList.remove(trapClass);
            el.removeAttribute(dataAttr);
        }
    });
}

function loadSession() {
    chrome.storage.sync.get(['mfp_last_search', 'mfp_settings'], data => {
        if (chrome.runtime.lastError) return;
        // Don't force panel visibility on load unless content is found in performHighlighting/autoScanTraps
        if (data.mfp_last_search) performHighlighting(data.mfp_last_search.words, data.mfp_last_search.options);
        else autoScanTraps();
    });
}

function navigate(word, dir) {
    const hl = Array.from(document.querySelectorAll(`[${dataAttr}="${word}"]`));
    if (!hl.length) return;
    if (currentHighlightIdx[word] === undefined) currentHighlightIdx[word] = 0;
    currentHighlightIdx[word] = (currentHighlightIdx[word] + dir + hl.length) % hl.length;
    hl[currentHighlightIdx[word]].scrollIntoView({ behavior: 'smooth', block: 'center' });
    hl[currentHighlightIdx[word]].style.outline = "2px solid #fff";
    setTimeout(() => { if (hl[currentHighlightIdx[word]]) hl[currentHighlightIdx[word]].style.outline = ""; }, 1500);
}

function clearAll() {
    clearNormal();
    foundResults = {};
    trapResults = {};
    isDismissed = false;
    chrome.storage.sync.remove('mfp_last_search');
    updateFloatingUI();
    const p = shadowRoot && shadowRoot.getElementById('panel');
    if(p) p.style.display = 'none';
}
function showCriticalAlert() {
    if (shadowRoot.getElementById(alertId)) return;
    const alertBox = document.createElement('div');
    alertBox.id = alertId;
    alertBox.style = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: #ff1744; color: #fff; padding: 15px 30px; border-radius: 50px;
        font-weight: 800; font-size: 16px; z-index: 2147483647;
        box-shadow: 0 10px 40px rgba(255,23,68,0.5); display: flex; align-items: center; gap: 15px;
        animation: tqBounce 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    `;
    const textSpan = document.createElement('span');
    textSpan.textContent = '🚨 ATTENTION: TRAP QUESTION DETECTED!';
    
    const closeSpan = document.createElement('span');
    closeSpan.style.cursor = 'pointer';
    closeSpan.style.opacity = '0.8';
    closeSpan.innerHTML = '&times;';
    closeSpan.onclick = () => alertBox.remove();
    
    alertBox.appendChild(textSpan);
    alertBox.appendChild(closeSpan);
    
    const s = document.createElement('style');
    s.textContent = `@keyframes tqBounce { 0% { top: -100px; } 100% { top: 20px; } }`;
    shadowRoot.appendChild(s);
    shadowRoot.appendChild(alertBox);
    
    setTimeout(() => { if(alertBox) alertBox.remove(); }, 5000);
}

function showTooltip(e) {
    const text = e.target.getAttribute(dataAttr);
    const count = foundResults[text] ? foundResults[text].count : 0;
    if (count === 0) return;

    let tip = shadowRoot.getElementById(tooltipId);
    if (!tip) {
        tip = document.createElement('div');
        tip.id = tooltipId;
        tip.style = `
            position: fixed; background: #1c1e21; color: #fff; padding: 6px 12px;
            border-radius: 6px; font-size: 11px; font-weight: 700; z-index: 2147483647;
            pointer-events: none; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1); transition: opacity 0.2s;
        `;
        shadowRoot.appendChild(tip);
    }
    tip.innerText = `"${text}" found ${count} times`;
    tip.style.display = 'block';
    tip.style.opacity = '1';
    
    const updatePos = (ev) => {
        tip.style.left = (ev.clientX + 10) + 'px';
        tip.style.top = (ev.clientY + 10) + 'px';
    };
    e.target.onmousemove = updatePos;
    updatePos(e);
}

function hideTooltip() {
    const tip = shadowRoot.getElementById(tooltipId);
    if (tip) tip.style.opacity = '0';
}

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
init();
