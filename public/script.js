document.addEventListener('DOMContentLoaded', () => {
    const workForm = document.getElementById('work-form');
    const entriesList = document.getElementById('entries-list');
    const totalTodayEl = document.getElementById('total-today');
    const totalWeekEl = document.getElementById('total-week');
    const formError = document.getElementById('form-error');
    const submitBtn = workForm.querySelector('button[type="submit"]');

    let editingId = null;
    let allEntries = [];

    // Check for token before anything else
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    // Logout logic
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    });

    // Password modal logic
    const modal = document.getElementById('password-modal');
    document.getElementById('btn-change-password').addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    document.getElementById('close-modal').addEventListener('click', () => {
        modal.style.display = 'none';
        document.getElementById('password-form').reset();
        document.getElementById('password-error').textContent = '';
    });

    document.getElementById('password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPassword = document.getElementById('old-password').value;
        const newPassword = document.getElementById('new-password').value;
        const errEl = document.getElementById('password-error');

        try {
            const res = await fetch('/api/auth/password', {
                method: 'PUT',
                headers: authHeaders,
                body: JSON.stringify({ oldPassword, newPassword })
            });
            const data = await res.json();

            if (res.ok) {
                errEl.style.color = '#10b981';
                errEl.textContent = 'Password updated!';
                setTimeout(() => {
                    modal.style.display = 'none';
                    document.getElementById('password-form').reset();
                    errEl.textContent = '';
                }, 2000);
            } else {
                errEl.style.color = '#ef4444';
                errEl.textContent = data.message || 'Error updating password';
            }
        } catch (e) {
            errEl.style.color = '#ef4444';
            errEl.textContent = 'Connection error';
        }
    });

    // Admin check
    const role = localStorage.getItem('role') || 'user';
    if (role === 'admin') {
        const adminBtn = document.getElementById('btn-admin-panel');
        if (adminBtn) {
            adminBtn.style.display = 'block';
            adminBtn.addEventListener('click', () => {
                window.location.href = 'admin.html';
            });
        }
    }

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
                    headers: authHeaders,
                    body: JSON.stringify(entryData)
                });
            } else {
                response = await fetch('/api/hours', {
                    method: 'POST',
                    headers: authHeaders,
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
            const response = await fetch('/api/hours', { headers: authHeaders });
            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            const entries = await response.json();
            allEntries = entries;
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
            const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;

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
                    <h3>Week: ${dateRange}</h3>
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <span class="week-total">${formatDuration(week.totalMinutes)}</span>
                        <button class="btn-copy-mini" onclick="copyWeekToClipboard('${weekKey}')" title="Copiar tabla para correo">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                    </div>
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
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    }

    window.deleteEntry = async (id) => {
        if (!confirm('¿Estás seguro de eliminar esta entrada?')) return;

        try {
            const response = await fetch(`/api/hours/${id}`, {
                method: 'DELETE',
                headers: authHeaders
            });
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

        submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Update';
        submitBtn.classList.add('btn-update');

        // Add cancel button if not exists
        if (!document.getElementById('btn-cancel')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'btn-cancel';
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn-secondary';
            cancelBtn.innerHTML = '<i class="fa-solid fa-times"></i> Cancel';
            cancelBtn.onclick = resetForm;
            workForm.appendChild(cancelBtn);
        }

        document.querySelector('.input-section').scrollIntoView({ behavior: 'smooth' });
    };

    function resetForm() {
        workForm.reset();
        const d = new Date();
        document.getElementById('date').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        document.getElementById('description').value = 'CornerStone';
        editingId = null;
        submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add';
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
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        let todayMinutes = 0;
        let weekMinutes = 0;

        const startOfWeek = getStartOfWeek(now);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        entries.forEach(entry => {
            const duration = calculateDuration(entry.startTime, entry.endTime);

            // Daily total
            if (entry.date === today) {
                todayMinutes += duration;
            }

            // Weekly total
            const entryDate = new Date(entry.date + 'T00:00:00');
            if (entryDate >= startOfWeek && entryDate <= endOfWeek) {
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
        return date.toLocaleDateString('en-US', options);
    }

    function showError(msg) {
        formError.textContent = msg;
        setTimeout(() => {
            formError.textContent = '';
        }, 3000);
    }

    function formatTimeAMPM(time24) {
        const [hour, minute] = time24.split(':');
        let h = parseInt(hour, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${minute} ${ampm}`;
    }

    window.copyWeekToClipboard = async (weekKey) => {
        try {
            const sortedEntries = [...allEntries].sort((a, b) => {
                const dateA = new Date(`${a.date}T${a.startTime}`);
                const dateB = new Date(`${b.date}T${b.startTime}`);
                return dateA - dateB;
            });

            let weekEntries = [];
            let totalMinutes = 0;

            sortedEntries.forEach(entry => {
                const date = new Date(entry.date + 'T00:00:00');
                const weekStart = getStartOfWeek(date);
                const currentWeekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;

                if (currentWeekKey === weekKey) {
                    weekEntries.push(entry);
                    totalMinutes += calculateDuration(entry.startTime, entry.endTime);
                }
            });

            if (weekEntries.length === 0) return;

            const weekStart = new Date(weekEntries[0].date + 'T00:00:00');
            const weekStartObj = getStartOfWeek(weekStart);
            const weekEndObj = new Date(weekStartObj);
            weekEndObj.setDate(weekEndObj.getDate() + 6);
            const dateRange = `${formatDateShort(weekStartObj)} - ${formatDateShort(weekEndObj)}`;

            let textContent = `Hello, This is my TimeSheet :\n\n`;
            textContent += `Hours Report: ${dateRange}\n\n`;
            textContent += `Date\tStart\tEnd\tDescription\tDuration\n`;
            textContent += `----------------------------------------------------------\n`;

            let htmlContent = `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <p style="font-size: 16px; margin-bottom: 20px;">Hello, This is my TimeSheet:</p>
                    <h2 style="color: #4f46e5;">Hours Report: ${dateRange}</h2>
                    <table style="border-collapse: collapse; width: 100%; max-width: 800px; text-align: left;">
                        <thead>
                            <tr style="background-color: #f3f4f6; color: #111;">
                                <th style="padding: 10px; border: 1px solid #d1d5db;">Date</th>
                                <th style="padding: 10px; border: 1px solid #d1d5db;">Start</th>
                                <th style="padding: 10px; border: 1px solid #d1d5db;">End</th>
                                <th style="padding: 10px; border: 1px solid #d1d5db;">Description</th>
                                <th style="padding: 10px; border: 1px solid #d1d5db;">Duration</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            weekEntries.forEach(entry => {
                const duration = calculateDuration(entry.startTime, entry.endTime);
                const durationStr = formatDuration(duration);
                // We use en-US format to make the output match English convention
                const entryDateObj = new Date(`${entry.date}T00:00:00`);
                const dateStr = entryDateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
                const startTime12 = formatTimeAMPM(entry.startTime);
                const endTime12 = formatTimeAMPM(entry.endTime);
                const descStr = entry.description || '';

                textContent += `${dateStr}\t${startTime12}\t${endTime12}\t${descStr}\t${durationStr}\n`;

                htmlContent += `
                    <tr>
                        <td style="padding: 10px; border: 1px solid #d1d5db;">${dateStr}</td>
                        <td style="padding: 10px; border: 1px solid #d1d5db;">${startTime12}</td>
                        <td style="padding: 10px; border: 1px solid #d1d5db;">${endTime12}</td>
                        <td style="padding: 10px; border: 1px solid #d1d5db;">${escapeHtml(descStr)}</td>
                        <td style="padding: 10px; border: 1px solid #d1d5db;">${durationStr}</td>
                    </tr>
                `;
            });

            const totalDecimalHours = Number((totalMinutes / 60).toFixed(2)) + ' hours';

            textContent += `----------------------------------------------------------\n`;
            textContent += `Total weekly hours:\t\t\t\t${totalDecimalHours}\n`;

            htmlContent += `
                            <tr style="background-color: #e5e7eb; font-weight: bold;">
                                <td colspan="4" style="padding: 10px; border: 1px solid #d1d5db; text-align: right;">Total weekly hours:</td>
                                <td style="padding: 10px; border: 1px solid #d1d5db;">${totalDecimalHours}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;

            if (navigator.clipboard && window.ClipboardItem) {
                const textBlob = new Blob([textContent], { type: 'text/plain' });
                const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
                const clipboardItem = new ClipboardItem({
                    'text/plain': textBlob,
                    'text/html': htmlBlob
                });
                await navigator.clipboard.write([clipboardItem]);
            } else {
                await navigator.clipboard.writeText(textContent);
            }

            const btn = document.querySelector(`button[onclick="copyWeekToClipboard('${weekKey}')"]`);
            if (btn) {
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado';
                btn.style.background = '#10b981';
                btn.style.borderColor = '#10b981';
                btn.style.color = '#fff';
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                    btn.style.background = '';
                    btn.style.borderColor = '';
                    btn.style.color = '';
                }, 2000);
            }

        } catch (error) {
            console.error('Error copying to clipboard:', error);
            alert('Error al copiar al portapapeles. Asegúrate de tener permisos o estar en un entorno seguro.');
        }
    };
});
