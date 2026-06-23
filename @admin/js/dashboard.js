import { getAdminAuthHeader } from './auth.js';

async function loadDashboard() {
    try {
        // Fetch dashboard statistics from the PHP admin API
        const response = await fetch('../api/admin/dashboard.php', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...getAdminAuthHeader()
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Update stat cards by ID
        const elStudents = document.getElementById('statStudents');
        if (elStudents) elStudents.textContent = data.students.toLocaleString();

        const elCourses = document.getElementById('statCourses');
        if (elCourses) elCourses.textContent = data.courses.toLocaleString();

        const elCerts = document.getElementById('statCerts');
        if (elCerts) elCerts.textContent = data.certs.toLocaleString();

        const elCompletion = document.getElementById('statCompletion');
        if (elCompletion) elCompletion.textContent = data.completion;

        // Update trend labels
        const trends = document.querySelectorAll('.stat-trend.syncing');
        trends.forEach(t => {
            t.innerHTML = '<span class="material-icons" style="font-size:14px;color:#16a34a;">check_circle</span> Up to date';
            t.classList.remove('syncing');
        });

        // Populate recent courses table
        populateRecentCourses(data.recentCourses);

    } catch (error) {
        console.error("Dashboard load error:", error);
        
        // Show error message in recent courses table
        const tbody = document.getElementById('dashRecentCourses');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:32px;color:#ef4444;">
                Failed to load administrative analytics. Check connection.
            </td></tr>`;
        }
    }
}

function populateRecentCourses(recentCourses) {
    const tbody = document.getElementById('dashRecentCourses');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!recentCourses || recentCourses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:32px;color:var(--text-muted);">No courses found.</td></tr>`;
        return;
    }

    const colors = ['indigo', 'teal', 'amber', 'emerald', 'blue'];
    
    recentCourses.forEach((course, index) => {
        const initials = course.title ? course.title.substring(0, 2).toUpperCase() : 'CO';
        const color = colors[index % colors.length];
        const status = course.status || 'Published';
        const statusColor = status === 'Published' ? '#16a34a' : '#d97706';
        const statusBg = status === 'Published' ? '#f0fdf4' : '#fffbeb';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:12px 16px;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:36px;height:36px;border-radius:8px;background:var(--${color}-soft,#eef2ff);color:var(--${color},#4f46e5);font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
                        ${course.thumbnailUrl ? `<img src="${course.thumbnailUrl}" style="width:100%;height:100%;object-fit:cover;">` : initials}
                    </div>
                    <span style="font-size:14px;font-weight:500;color:var(--text-main);">${course.title || 'Untitled'}</span>
                </div>
            </td>
            <td style="padding:12px 16px;font-size:13px;color:var(--text-muted);">${course.totalLessons} Modules</td>
            <td style="padding:12px 16px;">
                <span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;background:${statusBg};color:${statusColor};">${status}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Run on load
loadDashboard();
