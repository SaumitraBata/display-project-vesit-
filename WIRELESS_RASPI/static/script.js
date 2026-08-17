// ========================================================
// TAB SWITCHING — Merit List / Seats / Message
//
// This only controls which admin panel is visible here on
// the control station. It does NOT change what the displays
// are showing — that only changes when you hit one of the
// "Send to Displays" buttons.
// ========================================================

function switchTab(tab) {

    const tabs = ['merit', 'seats', 'message'];

    tabs.forEach(t => {
        const panel = document.getElementById(`tab-${t}`);
        const btn = document.getElementById(`tabbtn-${t}`);

        const isActive = t === tab;

        panel.classList.toggle('hidden', !isActive);

        btn.classList.toggle('bg-indigo-600', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('shadow-sm', isActive);
        btn.classList.toggle('text-slate-600', !isActive);
        btn.classList.toggle('hover:bg-white', !isActive);
    });

    // Nav controls (up/down/send for the merit list) only make sense
    // while the Merit List tab is open and a file is loaded.
    if (tab !== 'merit' || visibleRows.length === 0) {
        navControls.classList.add('hidden');
    } else {
        navControls.classList.remove('hidden');
    }
}


// ========================================================
// MERIT LIST
// ========================================================

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const uploadSection = document.getElementById('upload-section');
const dataSection = document.getElementById('data-section');
const tablesContainer = document.getElementById('tables-container');
const searchInput = document.getElementById('search-input');
const rowCount = document.getElementById('row-count');
const resetBtn = document.getElementById('reset-btn');
const navControls = document.getElementById('nav-controls');

let rawTablesData = [];
let visibleRows = []; // Stores currently visible row data and element IDs
let selectedIndex = -1; // Tracks which row is highlighted

// File handling
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('border-indigo-600', 'bg-indigo-50/20'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('border-indigo-600', 'bg-indigo-50/20'));
dropzone.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });

resetBtn.addEventListener('click', () => {
    uploadSection.classList.remove('hidden');
    dataSection.classList.add('hidden');
    navControls.classList.add('hidden');
    fileInput.value = '';
    selectedIndex = -1;
    visibleRows = [];
});

async function handleFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        const result = await response.json();
        if (response.ok) {
            rawTablesData = result.tables;
            uploadSection.classList.add('hidden');
            dataSection.classList.remove('hidden');
            navControls.classList.remove('hidden');
            renderTables(rawTablesData);
        } else {
            alert(result.detail || 'Error parsing file.');
        }
    } catch (err) { alert('Server error. Ensure backend is running.'); }
}

function renderTables(tables, filterQuery = '') {
    tablesContainer.innerHTML = '';
    visibleRows = [];
    selectedIndex = -1;
    let globalRowCounter = 0;

    tables.forEach((table) => {
        const filteredRows = table.rows.filter(row => {
            if (!filterQuery) return true;
            return Object.values(row).some(val => String(val).toLowerCase().includes(filterQuery.toLowerCase()));
        });

        if (filteredRows.length === 0) return;

        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden';

        let tableHTML = `<div class="overflow-x-auto"><table class="w-full text-left text-xs border-collapse">
            <thead><tr class="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">`;
        table.headers.forEach(h => tableHTML += `<th class="py-3.5 px-4">${h}</th>`);
        tableHTML += `</tr></thead><tbody class="divide-y divide-slate-100 font-medium text-slate-700">`;

        filteredRows.forEach((row) => {
            const rowId = `row-${globalRowCounter}`;
            visibleRows.push({ id: rowId, data: row });

            tableHTML += `<tr id="${rowId}" class="selectable-row transition-all duration-150 cursor-pointer" onclick="selectRow(${globalRowCounter})">`;
            table.headers.forEach(h => {
                let val = row[h] || '-';
                tableHTML += `<td class="py-3 px-4 whitespace-nowrap">${val}</td>`;
            });
            tableHTML += `</tr>`;
            globalRowCounter++;
        });
        tableHTML += `</tbody></table></div>`;
        card.innerHTML = tableHTML;
        tablesContainer.appendChild(card);
    });

    rowCount.textContent = `${visibleRows.length} records found`;

    // Auto-select first row if data exists
    if (visibleRows.length > 0) {
        selectRow(0);
        navControls.classList.remove('hidden');
    } else {
        navControls.classList.add('hidden');
    }
}

// Search
searchInput.addEventListener('input', (e) => renderTables(rawTablesData, e.target.value.trim()));

// --- Navigation Logic ---
function selectRow(index) {
    if (index < 0 || index >= visibleRows.length) return;
    selectedIndex = index;

    // Remove highlight from all rows
    document.querySelectorAll('.selectable-row').forEach(el => {
        el.classList.remove('bg-indigo-100', 'font-semibold');
        el.classList.add('bg-white');
    });

    // Highlight selected row
    const activeEl = document.getElementById(visibleRows[selectedIndex].id);
    if (activeEl) {
        activeEl.classList.remove('bg-white');
        activeEl.classList.add('bg-indigo-100', 'font-semibold');
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

async function sendToRaspberryPi() {
    if (selectedIndex < 0 || selectedIndex >= visibleRows.length) return;

    const rowData = visibleRows[selectedIndex].data;

    // Check for various ways the Excel might have named the Candidate/Candidature Type column
    const candidateType = rowData['Candidate Type'] ||
                        rowData['Candidature Type'] ||
                        rowData['Candidatur e Type'] ||
                        'N/A';

    // Map the specific columns to the required JSON structure
    const payload = {
        category: candidateType,
        id: rowData['DTE/CET APP. ID'] || 'N/A',
        name: rowData['Name'] || 'N/A'
    };

    try {
        const response = await fetch('/api/update_student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast();
        } else {
            alert("Failed to update the central server.");
        }
    } catch (err) {
        alert("Connection error. Ensure your main FastAPI server is running.");
    }
}

document.getElementById('btn-up').addEventListener('click', () => selectRow(selectedIndex - 1));
document.getElementById('btn-down').addEventListener('click', () => selectRow(selectedIndex + 1));
document.getElementById('btn-send').addEventListener('click', sendToRaspberryPi);


// ========================================================
// SEATS TAB
// ========================================================

const DEPARTMENTS = ["CMPN", "INFT", "AURO", "EXTC", "AIDS", "ECS"];

async function sendSeats() {

    const payload = {};

    DEPARTMENTS.forEach(dept => {
        const input = document.getElementById(`seat-${dept}`);
        const val = input.value.trim();
        if (val !== "") {
            payload[dept] = Number(val);
        }
    });

    try {
        const response = await fetch('/api/update_seats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast();
        } else {
            alert("Failed to update seat counts.");
        }
    } catch (err) {
        alert("Connection error. Ensure your main FastAPI server is running.");
    }
}

document.getElementById('btn-send-seats').addEventListener('click', sendSeats);


// ========================================================
// MESSAGE TAB
// ========================================================

const messageInput = document.getElementById('message-input');

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        messageInput.value = btn.dataset.text;
        sendMessage();
    });
});

async function sendMessage() {

    const text = messageInput.value.trim();

    if (!text) {
        alert("Enter a message, or pick one of the presets, first.");
        return;
    }

    try {
        const response = await fetch('/api/update_message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        if (response.ok) {
            showToast();
        } else {
            alert("Failed to send message.");
        }
    } catch (err) {
        alert("Connection error. Ensure your main FastAPI server is running.");
    }
}

document.getElementById('btn-send-message').addEventListener('click', sendMessage);


// ========================================================
// TOAST
// ========================================================

function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 2500);
}


// ========================================================
// KEYBOARD SHORTCUTS — only active on the Merit List tab
// ========================================================

document.addEventListener('keydown', (e) => {
    const meritTabActive = !document.getElementById('tab-merit').classList.contains('hidden');
    if (!meritTabActive) return;
    if (uploadSection.classList.contains('hidden') === false) return; // Prevent navigation if no table
    if (document.activeElement === searchInput && e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectRow(selectedIndex + 1);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectRow(selectedIndex - 1);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        sendToRaspberryPi();
    }
});
