// ============================================================
// VESIT Control Station — Main JavaScript Module
// ============================================================

// DOM Element Selections
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const uploadSection = document.getElementById('upload-section');
const dataSection = document.getElementById('data-section');
const tablesContainer = document.getElementById('tables-container');
const searchInput = document.getElementById('search-input');
const rowCount = document.getElementById('row-count');
const resetBtn = document.getElementById('reset-btn');
const navControls = document.getElementById('nav-controls');

// State Management
let rawTablesData = [];
let visibleRows = [];   // Stores currently visible row data and element IDs
let selectedIndex = -1; // Tracks currently highlighted row index

// Dynamic Visual Indicators (Left & Right Arrow Callouts)
const leftArrow = document.createElement('div');
const rightArrow = document.createElement('div');

const arrowBaseStyles = `
    position: fixed;
    z-index: 1000;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 800;
    color: var(--maroon, #5c1023);
    background: var(--surface, #fffdf8);
    border: 2px solid var(--maroon, #5c1023);
    border-radius: 50%;
    opacity: 0;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(26, 19, 16, 0.15);
    transition: opacity 150ms ease, transform 150ms ease;
`;

leftArrow.style.cssText = arrowBaseStyles;
rightArrow.style.cssText = arrowBaseStyles;

leftArrow.innerHTML = '◀';
rightArrow.innerHTML = '▶';

document.body.appendChild(leftArrow);
document.body.appendChild(rightArrow);

// ------------------------------------------------------------
// File Upload & Drag-and-Drop Handlers
// ------------------------------------------------------------
dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--maroon)';
    dropzone.style.backgroundColor = 'var(--cream-deep)';
});

dropzone.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'var(--border)';
    dropzone.style.backgroundColor = 'var(--surface)';
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--border)';
    dropzone.style.backgroundColor = 'var(--surface)';
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

resetBtn.addEventListener('click', () => {
    uploadSection.classList.remove('hidden');
    dataSection.classList.add('hidden');
    navControls.classList.add('hidden');
    fileInput.value = '';
    selectedIndex = -1;
    positionArrows(null);
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
    } catch (err) {
        alert('Server error. Ensure FastAPI backend is running.');
    }
}

// ------------------------------------------------------------
// Table Rendering & Filtering
// ------------------------------------------------------------
function renderTables(tables, filterQuery = '') {
    tablesContainer.innerHTML = '';
    visibleRows = [];
    selectedIndex = -1;
    let globalRowCounter = 0;

    tables.forEach((table) => {
        const filteredRows = table.rows.filter(row => {
            if (!filterQuery) return true;
            return Object.values(row).some(val => 
                String(val).toLowerCase().includes(filterQuery.toLowerCase())
            );
        });

        if (filteredRows.length === 0) return;

        const card = document.createElement('div');
        card.className = 'tables-wrapper';

        let tableHTML = `<table style="width: max-content; min-width: 100%; border-collapse: collapse; text-align: left; font-size: 0.78rem;">
            <thead><tr style="background: var(--cream-deep); border-bottom: 1px solid var(--border); color: var(--ink); font-weight: 700;">`;
        
        table.headers.forEach(h => {
            tableHTML += `<th style="padding: 6px 10px; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.02em; white-space: nowrap;">${h}</th>`;
        });
        
        tableHTML += `</tr></thead><tbody>`;

        filteredRows.forEach((row) => {
            const rowId = `row-${globalRowCounter}`;
            visibleRows.push({ id: rowId, data: row });

            tableHTML += `<tr id="${rowId}" class="selectable-row" onclick="selectRow(${globalRowCounter})" style="cursor: pointer; border-bottom: 1px solid var(--border); transition: background-color 150ms ease;">`;
            
            table.headers.forEach(h => {
                let val = row[h] !== undefined && row[h] !== null && row[h] !== '' ? row[h] : '-';
                tableHTML += `<td style="padding: 6px 10px; white-space: nowrap; font-size: 0.78rem;">${val}</td>`;
            });
            
            tableHTML += `</tr>`;
            globalRowCounter++;
        });

        tableHTML += `</tbody></table>`;
        card.innerHTML = tableHTML;
        tablesContainer.appendChild(card);
    });

    rowCount.textContent = `${visibleRows.length} RECORDS FOUND`;

    // Automatically highlight the first record if rows are present
    if (visibleRows.length > 0) {
        selectRow(0);
    } else {
        positionArrows(null);
    }
}

// Live Search Field Dispatch
searchInput.addEventListener('input', (e) => {
    renderTables(rawTablesData, e.target.value.trim());
});

// ------------------------------------------------------------
// Row Selection & Visual Arrow Positioning
// ------------------------------------------------------------
function selectRow(index) {
    if (index < 0 || index >= visibleRows.length) return;

    selectedIndex = index;

    // Reset styles on all table rows
    document.querySelectorAll('.selectable-row').forEach(el => {
        el.style.backgroundColor = 'transparent';
        el.style.borderLeft = 'none';
    });

    // Apply active styling to the currently selected row
    const activeEl = document.getElementById(visibleRows[selectedIndex].id);

    if (activeEl) {
        activeEl.style.backgroundColor = 'var(--cream-deep)';
        activeEl.style.borderLeft = '4px solid var(--maroon)';

        activeEl.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        // Delay arrow calculations briefly to account for smooth scroll movement
        setTimeout(() => positionArrows(activeEl), 80);
    }
}

function positionArrows(row) {
    if (!row) {
        leftArrow.style.opacity = '0';
        rightArrow.style.opacity = '0';
        return;
    }

    const rect = row.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;

    leftArrow.style.left = `${Math.max(8, rect.left - 34)}px`;
    rightArrow.style.left = `${rect.right + 10}px`;

    leftArrow.style.top = `${centerY - 13}px`;
    rightArrow.style.top = `${centerY - 13}px`;

    leftArrow.style.opacity = '1';
    rightArrow.style.opacity = '1';
}

// Keep arrow overlay aligned during container/window scrolling
window.addEventListener('scroll', () => {
    if (selectedIndex < 0 || selectedIndex >= visibleRows.length) return;
    const activeEl = document.getElementById(visibleRows[selectedIndex].id);
    if (activeEl) positionArrows(activeEl);
}, true);

// ------------------------------------------------------------
// Server Dispatch & Payload Formulation
// ------------------------------------------------------------
async function sendToRaspberryPi() {
    if (selectedIndex < 0 || selectedIndex >= visibleRows.length) return;

    const rowData = visibleRows[selectedIndex].data;

    // Extract Candidate Type across common Excel header permutations
    const candidateType = rowData['Candidate Type'] ||
                          rowData['Candidature Type'] ||
                          rowData['Candidatur e Type'] ||
                          'N/A';

    const payload = {
        category: candidateType,
        id: rowData['DTE/CET APP. ID'] || rowData['Application ID'] || 'N/A',
        name: rowData['Name'] || rowData['Student Name'] || 'N/A'
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

// ------------------------------------------------------------
// Toast Notification
// ------------------------------------------------------------
function showToast() {
    const toast = document.getElementById('toast');
    if (!toast) return;

    // Handle class-based or inline-style toast visibility smoothly
    toast.classList.add('is-visible');
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.classList.remove('is-visible');
        toast.style.transform = 'translateY(100px)';
        toast.style.opacity = '0';
    }, 2500);
}

// ------------------------------------------------------------
// Navigation Event Listeners
// ------------------------------------------------------------
document.getElementById('btn-up')?.addEventListener('click', () => selectRow(selectedIndex - 1));
document.getElementById('btn-down')?.addEventListener('click', () => selectRow(selectedIndex + 1));
document.getElementById('btn-send')?.addEventListener('click', sendToRaspberryPi);

// Keyboard Keybind Shortcuts (Arrow Up, Arrow Down, Enter)
document.addEventListener('keydown', (e) => {
    // Disable shortcuts if upload screen is currently visible
    if (!uploadSection.classList.contains('hidden')) return;

    // Allow user to freely type inside search box without hijacking left/right keys
    if (document.activeElement === searchInput && e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
        return;
    }

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