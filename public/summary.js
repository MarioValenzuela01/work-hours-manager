// summary.js

const summaryTable = document.getElementById('summaryTable');
const weekRangeSelect = document.getElementById('weekRangeSelect');
const monthSelect = document.getElementById('monthSelect');

let hoursData = [];
let groupedWeeks = {};

async function loadHoursFromDatabase() {
    try {
        const token = localStorage.getItem('token');

        const response = await fetch('/api/hours/summary', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Error loading hours summary');
        }

        hoursData = await response.json();

        populateWeekRanges(hoursData);
        populateMonths(hoursData);
        loadTable(hoursData);

    } catch (error) {
        console.error(error);

        summaryTable.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-danger">
                    Error loading hours summary
                </td>
            </tr>
        `;
    }
}

function populateWeekRanges(data) {
    weekRangeSelect.innerHTML = '<option value="">All Weeks</option>';

    const ranges = [];

    data.forEach(item => {
        const range = getWeekRange(item.date);
        const value = `${range.start}|${range.end}`;
        const label = `${range.start} to ${range.end}`;

        if (!ranges.includes(value)) {
            ranges.push(value);

            weekRangeSelect.innerHTML += `
                <option value="${value}">
                    ${label}
                </option>
            `;
        }
    });
}

function getWeekRange(dateString) {
    const date = new Date(dateString + 'T00:00:00');

    const day = date.getDay(); // Sunday = 0
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
        start: formatDate(monday),
        end: formatDate(sunday)
    };
}
function populateMonths(data) {
    monthSelect.innerHTML = '<option value="">All Months</option>';

    const months = [];

    data.forEach(item => {
        const date = new Date(item.date + 'T00:00:00');

        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        const label = date.toLocaleString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        if (!months.includes(value)) {
            months.push(value);

            monthSelect.innerHTML += `
                <option value="${value}">
                    ${label}
                </option>
            `;
        }
    });
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function loadTable(data) {

    summaryTable.innerHTML = '';

    if (data.length === 0) {
        summaryTable.innerHTML = `
            <tr>
                <td colspan="3" class="text-center">
                    No hours found
                </td>
            </tr>
        `;
        return;
    }

    const grouped = {};

    data.forEach(item => {

        const range = getWeekRange(item.date);

        const key = `${range.start} to ${range.end}`;

        if (!grouped[key]) {
            grouped[key] = {
                entries: 0,
                totalHours: 0,
                items: []
            };
        }

        grouped[key].entries += 1;
        grouped[key].totalHours += Number(item.totalHours) || 0;
        grouped[key].items.push(item);
    });

    Object.keys(grouped).forEach(key => {

        const week = grouped[key];

        summaryTable.innerHTML += `
            <tr>
                <td>${key}</td>

                <td>
                    <button class="btn btn-link p-0"
                        onclick="showWeekDetails('${key}')">
                        ${week.entries} entries
                    </button>
                </td>

                <td>
                    <span class="hours-badge">
                        ${week.totalHours.toFixed(1)} hrs
                    </span>
                </td>
            </tr>
        `;
    });
    groupedWeeks = grouped;
}

document.getElementById('applyFilters')
    .addEventListener('click', () => {

        let filteredData = [...hoursData];

        const filterWeek = document.getElementById('filterWeek').checked;
        const filterHours = document.getElementById('filterHours').checked;
        const filterEmployee = document.getElementById('filterEmployee').checked;
        const filterMonth = document.getElementById('filterMonth').checked;

        const selectedMonth = monthSelect.value;
        const selectedWeekRange = weekRangeSelect.value;
        const minHours = parseFloat(document.getElementById('minHours').value);
        const employeeSearch = document.getElementById('employeeSearch').value.toLowerCase();

        if (filterWeek && selectedWeekRange !== '') {
            const [start, end] = selectedWeekRange.split('|');

            filteredData = filteredData.filter(item => {
                const itemDate = item.date;
                return itemDate >= start && itemDate <= end;
            });
        }

        if (filterHours && !isNaN(minHours)) {
            filteredData = filteredData.filter(item =>
                item.totalHours >= minHours
            );
        }

        if (filterMonth && selectedMonth !== '') {
            filteredData = filteredData.filter(item =>
                item.date.startsWith(selectedMonth)
            );
        }

        if (filterEmployee && employeeSearch !== '') {
            filteredData = filteredData.filter(item =>
                item.employee.toLowerCase().includes(employeeSearch)
            );
        }

        loadTable(filteredData);
        
    });

function showWeekDetails(weekKey) {

    const week = groupedWeeks[weekKey];

    const title = document.getElementById('weekDetailsTitle');
    const table = document.getElementById('weekDetailsTable');

    title.textContent = `Details: ${weekKey}`;

    table.innerHTML = '';

    // PRACTICUM ENTRIES
    const practicumItems = week.items.filter(item =>
        item.recordType === 'practicum'
    );

    // WORK ENTRIES
    const workItems = week.items.filter(item =>
        (item.recordType || 'work') === 'work'
    );

    // PRACTICUM SECTION
    if (practicumItems.length > 0) {

        let practicumTotal = 0;

        table.innerHTML += `
            <tr class="table-primary">
                <td colspan="6">
                    <strong>Practicum Entries</strong>
                </td>
            </tr>
        `;

        practicumItems.forEach(item => {

            practicumTotal += Number(item.totalHours) || 0;

            table.innerHTML += `
                <tr>
                    <td>${item.date}</td>

                    <td>${item.totalHours} hrs</td>
                    <td>${item.recordType}</td>
                    <td>${item.description || ''}</td>
                </tr>
            `;
        });

        table.innerHTML += `
            <tr class="table-primary">
                <td colspan="3">
                    <strong>Total Practicum Hours</strong>
                </td>

                <td colspan="3">
                    <strong>${practicumTotal.toFixed(1)} hrs</strong>
                </td>
            </tr>
        `;
    }

    // WORK SECTION
    if (workItems.length > 0) {

        let workTotal = 0;

        table.innerHTML += `
            <tr class="table-warning">
                <td colspan="6">
                    <strong>Regular Work Entries</strong>
                </td>
            </tr>
        `;

        workItems.forEach(item => {

            workTotal += Number(item.totalHours) || 0;

            table.innerHTML += `
                <tr>
                    <td>${item.date}</td> 
                    <td>${item.totalHours} hrs</td>
                    <td>${item.recordType}</td>
                    <td>${item.description || ''}</td>
                </tr>
            `;
        });

        table.innerHTML += `
            <tr class="table-warning">
                <td colspan="3">
                    <strong>Total Work Hours</strong>
                </td>

                <td colspan="3">
                    <strong>${workTotal.toFixed(1)} hrs</strong>
                </td>
            </tr>
        `;
    }

    const modal =
        new bootstrap.Modal(
            document.getElementById('weekDetailsModal')
        );

    modal.show();
}

loadHoursFromDatabase();