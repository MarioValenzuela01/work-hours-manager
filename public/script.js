document.addEventListener('DOMContentLoaded', () => {
    const workForm = document.getElementById('work-form');
    const entriesList = document.getElementById('entries-list');
    const totalTodayEl = document.getElementById('total-today');
    const totalWeekEl = document.getElementById('total-week');
    const formError = document.getElementById('form-error');
    const submitBtn = workForm.querySelector('button[type="submit"]');

    let editingId = null;

    // Set default date to today
    resetForm();

    // Fetch and display entries on load
    fetchEntries();

    workForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError.textContent = '';

        const date = document.getElementById('date').value;
        const startTime = document.getElementById('start-time').value;
        const endTime = document.getElementById('end-time').value;
        const description = document.getElementById('description').value;

        if (!date || !startTime || !endTime) {
            showError('Por favor completa todos los campos requeridos');
            return;
        }

        if (startTime >= endTime) {
            showError('La hora de fin debe ser posterior a la de inicio');
            return;
        }

        const entryData = { date, startTime, endTime, description };

        try {
            let response;
            if (editingId) {
                response = await fetch(`/api/hours/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(entryData)
                });
            } else {
                response = await fetch('/api/hours', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(entryData)
                });
            }

            if (response.ok) {
                resetForm();
                fetchEntries();
            } else {
                showError('Error al guardar la entrada');
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Error de conexión con el servidor');
        }
    });

    async function fetchEntries() {
        try {
            const response = await fetch('/api/hours');
            const entries = await response.json();
            renderEntries(entries);
            updateDashboard(entries);
        } catch (error) {
            console.error('Error fetching entries:', error);
            entriesList.innerHTML = '<p class="error-msg">Error al cargar los datos</p>';
        }
    }

    function renderEntries(entries) {
        entriesList.innerHTML = '';

        if (entries.length === 0) {
            entriesList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-calendar-xmark"></i>
                    <p>No hay registros aún</p>
                </div>`;
            return;
        }

        // Sort entries by date desc, then by start time desc
        entries.sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.startTime}`);
            const dateB = new Date(`${b.date}T${b.startTime}`);
            return dateB - dateA;
        });

        const weeks = {};

        entries.forEach(entry => {
            const date = new Date(entry.date + 'T00:00:00');
            const weekStart = getStartOfWeek(date);
            const weekKey = weekStart.toISOString().split('T')[0];

            if (!weeks[weekKey]) {
                weeks[weekKey] = {
                    start: weekStart,
                    entries: [],
                    totalMinutes: 0
                };
            }

            const duration = calculateDuration(entry.startTime, entry.endTime);
            weeks[weekKey].entries.push(entry);
            weeks[weekKey].totalMinutes += duration;
        });

        // Sort weeks desc
        const sortedWeeks = Object.keys(weeks).sort((a, b) => new Date(b) - new Date(a));

        sortedWeeks.forEach(weekKey => {
            const week = weeks[weekKey];
            const weekCard = document.createElement('div');
            weekCard.className = 'week-card glass'; // Reuse glass effect but specific class

            const weekEnd = new Date(week.start);
            weekEnd.setDate(weekEnd.getDate() + 6);

            const dateRange = `${formatDateShort(week.start)} - ${formatDateShort(weekEnd)}`;

            let entriesHtml = '';
            week.entries.forEach(entry => {
                const duration = calculateDuration(entry.startTime, entry.endTime);
                entriesHtml += `
                    <div class="day-row">
                        <div class="day-info">
                            <span class="day-date">${formatDate(entry.date)}</span>
                            <span class="day-time">${entry.startTime} - ${entry.endTime}</span>
                            <span class="day-desc">${entry.description || ''}</span>
                        </div>
                        <div class="day-actions">
                            <span class="duration-pill">${formatDuration(duration)}</span>
                            <button class="btn-edit-mini" onclick="editEntry('${entry.id}', '${entry.date}', '${entry.startTime}', '${entry.endTime}', '${escapeHtml(entry.description || '')}')" title="Editar">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn-delete-mini" onclick="deleteEntry('${entry.id}')" title="Eliminar">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });

            weekCard.innerHTML = `
                <div class="week-header">
                    <h3>Semana: ${dateRange}</h3>
                    <span class="week-total">${formatDuration(week.totalMinutes)}</span>
                </div>
                <div class="week-entries">
                    ${entriesHtml}
                </div>
            `;

            entriesList.appendChild(weekCard);
        });
    }

    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function formatDateShort(date) {
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }

    window.deleteEntry = async (id) => {
        if (!confirm('¿Estás seguro de eliminar esta entrada?')) return;

        try {
            const response = await fetch(`/api/hours/${id}`, { method: 'DELETE' });
            if (response.ok) {
                fetchEntries();
            } else {
                alert('Error al eliminar la entrada');
            }
        } catch (error) {
            console.error('Error deleting entry:', error);
        }
    };

    window.editEntry = (id, date, start, end, desc) => {
        editingId = id;
        document.getElementById('date').value = date;
        document.getElementById('start-time').value = start;
        document.getElementById('end-time').value = end;
        document.getElementById('description').value = desc;

        submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Actualizar';
        submitBtn.classList.add('btn-update');

        // Add cancel button if not exists
        if (!document.getElementById('btn-cancel')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'btn-cancel';
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn-secondary';
            cancelBtn.innerHTML = '<i class="fa-solid fa-times"></i> Cancelar';
            cancelBtn.onclick = resetForm;
            workForm.appendChild(cancelBtn);
        }

        document.querySelector('.input-section').scrollIntoView({ behavior: 'smooth' });
    };

    function resetForm() {
        workForm.reset();
        document.getElementById('date').valueAsDate = new Date();
        editingId = null;
        submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Agregar';
        submitBtn.classList.remove('btn-update');

        const cancelBtn = document.getElementById('btn-cancel');
        if (cancelBtn) cancelBtn.remove();
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function updateDashboard(entries) {
        const today = new Date().toISOString().split('T')[0];
        let todayMinutes = 0;
        let weekMinutes = 0;

        // Simple "This Week" calculation (Monday to Sunday)
        const now = new Date();
        const dayOfWeek = now.getDay() || 7; // 1 (Mon) to 7 (Sun)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
        startOfWeek.setHours(0, 0, 0, 0);

        entries.forEach(entry => {
            const duration = calculateDuration(entry.startTime, entry.endTime);

            // Daily total
            if (entry.date === today) {
                todayMinutes += duration;
            }

            // Weekly total
            const entryDate = new Date(entry.date);
            // Reset entry time to midnight for comparison
            const entryDateMidnight = new Date(entryDate);
            entryDateMidnight.setHours(0, 0, 0, 0);

            // Adjust for timezone offset issue with simple date strings creates defaults to UTC 
            // We'll just compare date strings for simplicity if "week" logic is complex, 
            // but let's do a rough check if it is >= startOfWeek
            if (entryDateMidnight >= startOfWeek) {
                weekMinutes += duration;
            }
        });

        totalTodayEl.textContent = formatDuration(todayMinutes);
        totalWeekEl.textContent = formatDuration(weekMinutes);
    }

    function calculateDuration(start, end) {
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        return endMinutes - startMinutes;
    }

    function formatDuration(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${m}m`;
    }

    function formatDate(dateString) {
        const options = { weekday: 'short', day: 'numeric', month: 'short' };
        // Validar y prevenir problemas de timezone agregando T00:00:00
        const date = new Date(`${dateString}T00:00:00`);
        return date.toLocaleDateString('es-ES', options);
    }

    function showError(msg) {
        formError.textContent = msg;
        setTimeout(() => {
            formError.textContent = '';
        }, 3000);
    }
});
