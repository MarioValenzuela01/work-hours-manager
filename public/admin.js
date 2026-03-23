document.addEventListener('DOMContentLoaded', () => {
    // Check for token and admin role before anything else
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    if (role !== 'admin') {
        alert('Acceso denegado: Se requieren permisos de administrador');
        window.location.href = 'index.html';
        return;
    }

    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    // Logout logic
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        window.location.href = 'login.html';
    });

    // Go back logic
    document.getElementById('btn-back-home').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // Load users by default
    fetchAdminUsers();

    // Admin Tabs
    document.getElementById('btn-view-users')?.addEventListener('click', () => {
        document.getElementById('admin-users-view').style.display = 'block';
        document.getElementById('admin-all-hours-view').style.display = 'none';
        fetchAdminUsers();
    });

    document.getElementById('btn-view-all-hours')?.addEventListener('click', () => {
        document.getElementById('admin-users-view').style.display = 'none';
        document.getElementById('admin-all-hours-view').style.display = 'block';
        fetchAdminAllHours();
    });

    // Admin functionality functions
    async function fetchAdminUsers() {
        try {
            const res = await fetch('/api/admin/users', { headers: authHeaders });
            const data = await res.json();
            if (data.ok) {
                renderAdminUsers(data.users);
            } else {
                alert('Error fetching users: ' + data.message);
            }
        } catch (err) {
            console.error(err);
        }
    }

    function renderAdminUsers(users) {
        const list = document.getElementById('admin-users-list');
        list.innerHTML = '';
        if (users.length === 0) {
            list.innerHTML = '<p>No users found</p>';
            return;
        }

        const table = document.createElement('table');
        table.style.width = '100%';
        table.innerHTML = `
            <thead>
                <tr style="text-align: left;">
                    <th>Username</th>
                    <th>Role</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(u => `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">${escapeHtml(u.username)}</td>
                        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);"><span class="duration-pill" style="background: ${u.role === 'admin' ? 'var(--primary-color)' : 'var(--bg-card)'}">${u.role}</span></td>
                        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <button class="btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 5px;" onclick="openAdminUserHoursModal('${u._id}', '${escapeHtml(u.username)}')"><i class="fa-solid fa-clock"></i> Ver Horas</button>
                            <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 5px;" onclick="openAdminResetModal('${u._id}', '${escapeHtml(u.username)}')">Cambiar Contraseña</button>
                            ${u.username !== localStorage.getItem('username') ? `<button class="btn-primary" style="background: var(--danger-color); border-color: var(--danger-color); padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="adminDeleteUser('${u._id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        list.appendChild(table);
    }

    window.openAdminResetModal = (userId, username) => {
        const modal = document.getElementById('admin-reset-pw-modal');
        const form = document.getElementById('admin-reset-pw-form');
        document.getElementById('admin-reset-pw-username').textContent = username;
        form.dataset.userId = userId;
        modal.style.display = 'flex';
    };

    document.getElementById('close-admin-reset-modal')?.addEventListener('click', () => {
        const modal = document.getElementById('admin-reset-pw-modal');
        modal.style.display = 'none';
        document.getElementById('admin-reset-pw-form').reset();
        document.getElementById('admin-password-error').textContent = '';
    });

    document.getElementById('admin-reset-pw-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = e.target.dataset.userId;
        const newPassword = document.getElementById('admin-new-password').value;
        const errEl = document.getElementById('admin-password-error');

        try {
            const res = await fetch('/api/admin/users/password', {
                method: 'PUT',
                headers: authHeaders,
                body: JSON.stringify({ userId, newPassword })
            });
            const data = await res.json();
            if (res.ok) {
                errEl.style.color = '#10b981';
                errEl.textContent = '¡Contraseña actualizada con éxito!';
                setTimeout(() => {
                    document.getElementById('admin-reset-pw-modal').style.display = 'none';
                    e.target.reset();
                    errEl.textContent = '';
                }, 2000);
            } else {
                errEl.style.color = '#ef4444';
                errEl.textContent = data.message || 'Error reseteando contraseña';
            }
        } catch (err) {
            errEl.style.color = '#ef4444';
            errEl.textContent = 'Error de conexión';
        }
    });

    window.adminDeleteUser = async (userId) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este usuario y todas sus horas registradas? Esta acción no se puede deshacer.')) return;
        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: authHeaders
            });
            if (res.ok) {
                fetchAdminUsers();
            } else {
                const data = await res.json();
                alert('Error al eliminar usuario: ' + data.message);
            }
        } catch (err) {
            console.error(err);
        }
    };

    window.openAdminUserHoursModal = async (userId, username) => {
        const modal = document.getElementById('admin-user-hours-modal');
        document.getElementById('admin-user-hours-username').textContent = username;
        const list = document.getElementById('admin-user-specific-hours-list');
        const totalSpan = document.getElementById('admin-user-total-hours');

        list.innerHTML = '<p>Cargando horas...</p>';
        totalSpan.textContent = '0h 0m';
        modal.style.display = 'flex';

        try {
            const res = await fetch(`/api/admin/users/${userId}/hours`, { headers: authHeaders });
            const data = await res.json();

            if (data.ok) {
                renderSpecificUserHours(data.hours, list, totalSpan);
            } else {
                list.innerHTML = `<p style="color: var(--danger-color);">Error fetching hours: ${data.message}</p>`;
            }
        } catch (err) {
            console.error(err);
            list.innerHTML = `<p style="color: var(--danger-color);">Connection error fetching explicit hours.</p>`;
        }
    };

    document.getElementById('close-admin-user-hours-modal')?.addEventListener('click', () => {
        document.getElementById('admin-user-hours-modal').style.display = 'none';
    });

    function renderSpecificUserHours(hours, listElement, totalSpanElement) {
        listElement.innerHTML = '';
        let totalMinutesForUser = 0;

        if (hours.length === 0) {
            listElement.innerHTML = '<p>Este usuario no tiene horas registradas en el sistema.</p>';
            return;
        }

        const table = document.createElement('table');
        table.style.width = '100%';
        table.innerHTML = `
            <thead>
                <tr style="text-align: left;">
                    <th>Fecha</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Descripción</th>
                    <th>Duración</th>
                </tr>
            </thead>
            <tbody>
                ${hours.map(h => {
            const duration = calculateDuration(h.startTime, h.endTime);
            totalMinutesForUser += duration;
            return `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">${formatDateShort(new Date(h.date + 'T00:00:00'))}</td>
                        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">${h.startTime}</td>
                        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">${h.endTime}</td>
                        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">${escapeHtml(h.description || 'Sin descripción')}</td>
                        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);"><span class="duration-pill">${formatDuration(duration)}</span></td>
                    </tr>
                `}).join('')}
            </tbody>
        `;
        listElement.appendChild(table);
        totalSpanElement.textContent = formatDuration(totalMinutesForUser);
    }

    async function fetchAdminAllHours() {
        try {
            const res = await fetch('/api/admin/hours', { headers: authHeaders });
            const data = await res.json();
            if (data.ok) {
                renderAdminAllHours(data.hours);
            } else {
                alert('Error fetching all hours: ' + data.message);
            }
        } catch (err) {
            console.error(err);
        }
    }

    function renderAdminAllHours(hours) {
        const list = document.getElementById('admin-all-hours-list');
        list.innerHTML = '';
        let totalGlobalMinutes = 0;

        if (hours.length === 0) {
            list.innerHTML = '<p>No hay horas registradas en el sistema aún.</p>';
            document.getElementById('admin-global-total').textContent = '0h 0m';
            return;
        }

        const table = document.createElement('table');
        table.style.width = '100%';
        table.innerHTML = `
            <thead>
                <tr style="text-align: left;">
                    <th>Usuario</th>
                    <th>Fecha</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Duración</th>
                </tr>
            </thead>
            <tbody>
                ${hours.map(h => {
            const duration = calculateDuration(h.startTime, h.endTime);
            totalGlobalMinutes += duration;
            return `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);"><strong>${escapeHtml(h.username)}</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">${formatDateShort(new Date(h.date + 'T00:00:00'))}</td>
                        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">${h.startTime}</td>
                        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">${h.endTime}</td>
                        <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);"><span class="duration-pill">${formatDuration(duration)}</span></td>
                    </tr>
                `}).join('')}
            </tbody>
        `;
        list.appendChild(table);
        document.getElementById('admin-global-total').textContent = formatDuration(totalGlobalMinutes);
    }

    // Helper functions
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

    function formatDateShort(date) {
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
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
});
