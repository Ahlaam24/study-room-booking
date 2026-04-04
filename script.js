// Sample study rooms data
const studyRooms = [
    {
        id: 1,
        name: "Quiet Study A",
        capacity: 2,
        amenities: ["Whiteboard", "Power Outlets", "WiFi"],
        floor: "Ground Floor"
    },
    {
        id: 2,
        name: "Collaboration Room B",
        capacity: 4,
        amenities: ["Whiteboard", "Projector", "Power Outlets", "WiFi"],
        floor: "1st Floor"
    },
    {
        id: 3,
        name: "Silent Study C",
        capacity: 2,
        amenities: ["Power Outlets", "WiFi"],
        floor: "2nd Floor"
    },
    {
        id: 4,
        name: "Group Study D",
        capacity: 6,
        amenities: ["Whiteboard", "Projector", "TV Screen", "Power Outlets", "WiFi"],
        floor: "1st Floor"
    },
    {
        id: 5,
        name: "Study Pod E",
        capacity: 2,
        amenities: ["Power Outlets", "WiFi"],
        floor: "Ground Floor"
    },
    {
        id: 6,
        name: "Conference Room F",
        capacity: 8,
        amenities: ["Whiteboard", "Projector", "TV Screen", "Video Conferencing", "Power Outlets", "WiFi"],
        floor: "2nd Floor"
    },
    {
        id: 7,
        name: "Study Room G",
        capacity: 4,
        amenities: ["Whiteboard", "Power Outlets", "WiFi"],
        floor: "Ground Floor"
    },
    {
        id: 8,
        name: "Quiet Zone H",
        capacity: 2,
        amenities: ["Power Outlets", "WiFi"],
        floor: "3rd Floor"
    }
];

/** Plain text → safe HTML text (prevents XSS when using innerHTML). */
function escapeHtml(value) {
    if (value == null) return '';
    const el = document.createElement('span');
    el.textContent = String(value);
    return el.innerHTML;
}

// --- Auth & user-scoped data (localStorage on this device) ---
const STORAGE_USERS = 'studyRoomUsers';
const STORAGE_SESSION = 'studyRoomSessionUserId';
const STORAGE_BOOKINGS = 'studyRoomBookings';

let pendingBookingRoomId = null;

function uint8ToBase64(bytes) {
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
}

function base64ToUint8(b64) {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

async function derivePasswordHash(password, saltUint8) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const hashBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: saltUint8,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        256
    );
    return new Uint8Array(hashBuffer);
}

function getUsers() {
    try {
        const raw = localStorage.getItem(STORAGE_USERS);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveUsers(users) {
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

function getSessionUserId() {
    return localStorage.getItem(STORAGE_SESSION);
}

function setSessionUserId(userId) {
    if (userId) localStorage.setItem(STORAGE_SESSION, userId);
    else localStorage.removeItem(STORAGE_SESSION);
}

function getCurrentUser() {
    const id = getSessionUserId();
    if (!id) return null;
    return getUsers().find((u) => u.id === id) || null;
}

function normalizeEmail(email) {
    return String(email).trim().toLowerCase();
}

async function verifyPassword(user, password) {
    const expected = base64ToUint8(user.passwordHash);
    const actual = await derivePasswordHash(password, base64ToUint8(user.salt));
    return timingSafeEqual(expected, actual);
}

function updateAuthBar() {
    const guest = document.getElementById('auth-guest');
    const userEl = document.getElementById('auth-user');
    const nameEl = document.getElementById('auth-user-name');
    const u = getCurrentUser();
    if (u) {
        guest.classList.add('hidden');
        userEl.classList.remove('hidden');
        nameEl.textContent = u.displayName || u.email;
    } else {
        guest.classList.remove('hidden');
        userEl.classList.add('hidden');
        nameEl.textContent = '';
    }
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function setFormError(el, message) {
    if (!el) return;
    if (message) {
        el.textContent = message;
        el.classList.remove('hidden');
    } else {
        el.textContent = '';
        el.classList.add('hidden');
    }
}

function wireModalCloses() {
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });
    ['login-modal', 'signup-modal'].forEach((id) => {
        const el = document.getElementById(id);
        el.addEventListener('click', (e) => {
            if (e.target === el) closeModal(id);
        });
    });
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Minimum date = local "today" (toISOString() would use UTC and confuse dates near midnight)
    const today = formatDateForInput();
    document.getElementById('date-filter').min = today;
    document.getElementById('booking-date').min = today;

    updateAuthBar();
    wireModalCloses();

    document.getElementById('btn-open-login').addEventListener('click', () => {
        setFormError(document.getElementById('login-error'), '');
        openModal('login-modal');
    });
    document.getElementById('btn-open-signup').addEventListener('click', () => {
        setFormError(document.getElementById('signup-error'), '');
        openModal('signup-modal');
    });
    document.getElementById('btn-logout').addEventListener('click', () => {
        setSessionUserId(null);
        pendingBookingRoomId = null;
        updateAuthBar();
        renderBookings();
        showSuccessMessage('You have been logged out.');
    });

    document.getElementById('login-switch-signup').addEventListener('click', () => {
        closeModal('login-modal');
        setFormError(document.getElementById('signup-error'), '');
        openModal('signup-modal');
    });
    document.getElementById('signup-switch-login').addEventListener('click', () => {
        closeModal('signup-modal');
        setFormError(document.getElementById('login-error'), '');
        openModal('login-modal');
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('login-error');
        setFormError(errEl, '');
        const email = normalizeEmail(document.getElementById('login-email').value);
        const password = document.getElementById('login-password').value;
        const user = getUsers().find((u) => normalizeEmail(u.email) === email);
        if (!user) {
            setFormError(errEl, 'No account found for that email.');
            return;
        }
        const ok = await verifyPassword(user, password);
        if (!ok) {
            setFormError(errEl, 'Incorrect password.');
            return;
        }
        setSessionUserId(user.id);
        e.target.reset();
        closeModal('login-modal');
        updateAuthBar();
        showSuccessMessage(`Welcome back, ${user.displayName || user.email}!`);
        tryOpenPendingBooking();
        renderBookings();
        if (document.getElementById('rooms-section').classList.contains('active')) renderRooms();
    });

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('signup-error');
        setFormError(errEl, '');
        const displayName = document.getElementById('signup-name').value.trim();
        const studentId = document.getElementById('signup-student-id').value.trim();
        const email = normalizeEmail(document.getElementById('signup-email').value);
        const password = document.getElementById('signup-password').value;
        if (password.length < 8) {
            setFormError(errEl, 'Password must be at least 8 characters.');
            return;
        }
        const users = getUsers();
        if (users.some((u) => normalizeEmail(u.email) === email)) {
            setFormError(errEl, 'An account with this email already exists.');
            return;
        }
        const saltBytes = crypto.getRandomValues(new Uint8Array(16));
        const saltB64 = uint8ToBase64(saltBytes);
        const passwordHash = uint8ToBase64(await derivePasswordHash(password, saltBytes));
        const newUser = {
            id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            email,
            displayName,
            studentId,
            salt: saltB64,
            passwordHash
        };
        users.push(newUser);
        saveUsers(users);
        setSessionUserId(newUser.id);
        e.target.reset();
        closeModal('signup-modal');
        updateAuthBar();
        showSuccessMessage('Account created. You are now signed in.');
        tryOpenPendingBooking();
        renderBookings();
        if (document.getElementById('rooms-section').classList.contains('active')) renderRooms();
    });

    // Load bookings from localStorage
    loadBookings();

    // Render rooms
    renderRooms();

    // Setup event listeners
    setupEventListeners();
});

function tryOpenPendingBooking() {
    if (pendingBookingRoomId == null) return;
    const roomId = pendingBookingRoomId;
    pendingBookingRoomId = null;
    openBookingModal(roomId);
}

// Setup all event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            switchTab(tab);
        });
    });

    // Filter events
    document.getElementById('capacity-filter').addEventListener('change', renderRooms);
    document.getElementById('date-filter').addEventListener('change', renderRooms);
    document.getElementById('time-filter').addEventListener('change', renderRooms);
    document.getElementById('clear-filters').addEventListener('click', clearFilters);

    // Modal events (scope close to booking modal — other modals use data-close-modal)
    const modal = document.getElementById('booking-modal');
    const bookingClose = modal.querySelector('.close');
    bookingClose.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // Booking form submission
    document.getElementById('booking-form').addEventListener('submit', handleBookingSubmit);
}

// Switch between tabs
function switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    if (tab === 'rooms') {
        document.getElementById('rooms-section').classList.add('active');
        renderRooms();
    } else {
        document.getElementById('bookings-section').classList.add('active');
        renderBookings();
    }
}

// Render rooms based on filters
function renderRooms() {
    const roomsGrid = document.getElementById('rooms-grid');
    const capacityFilter = document.getElementById('capacity-filter').value;
    const dateFilter = document.getElementById('date-filter').value;
    const timeFilter = document.getElementById('time-filter').value;

    const bookings = getBookings();

    roomsGrid.innerHTML = '';

    studyRooms.forEach(room => {
        // Apply capacity filter
        if (capacityFilter !== 'all') {
            const capacity = parseInt(capacityFilter);
            if (room.capacity < capacity || (capacity === 8 && room.capacity < 8)) {
                return;
            }
        }

        // Pass all bookings: a slot on date D can be blocked by a booking that started the previous day and crosses midnight
        const isAvailable = checkRoomAvailability(room.id, dateFilter, timeFilter, bookings);

        const roomCard = document.createElement('div');
        roomCard.className = `room-card ${!isAvailable ? 'unavailable' : ''}`;
        
        roomCard.innerHTML = `
            <div class="room-header">
                <div class="room-name">${room.name}</div>
                <div class="room-status ${isAvailable ? 'available' : 'unavailable'}">
                    ${isAvailable ? 'Available' : 'Unavailable'}
                </div>
            </div>
            <div class="room-info">
                <div class="room-info-item">
                    <span>👥</span>
                    <span>Capacity: ${room.capacity} people</span>
                </div>
                <div class="room-info-item">
                    <span>📍</span>
                    <span>${room.floor}</span>
                </div>
            </div>
            <div class="amenities">
                ${room.amenities.map(amenity => `<span class="amenity-tag">${amenity}</span>`).join('')}
            </div>
            ${isAvailable ? `<button class="btn-primary" onclick="openBookingModal(${room.id})">Book Now</button>` : ''}
        `;

        roomsGrid.appendChild(roomCard);
    });
}

// --- Booking time as real instants (handles sessions that cross midnight) ---
/** YYYY-MM-DD in the user's local timezone (for date input min/max). */
function formatDateForInput(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseLocalDateTime(dateStr, timeStr) {
    const d = new Date(`${dateStr}T${timeStr}`);
    return isNaN(d.getTime()) ? null : d;
}

function bookingInterval(booking) {
    const start = parseLocalDateTime(booking.date, booking.startTime);
    if (!start) return null;
    const hours = Number(booking.duration);
    if (!Number.isFinite(hours) || hours <= 0) return null;
    const end = new Date(start.getTime() + hours * 3600000);
    return { start, end };
}

function intervalsOverlap(startA, endA, startB, endB) {
    return startA < endB && startB < endA;
}

// Check if room is available at given date/time
function checkRoomAvailability(roomId, date, time, bookings) {
    if (!date || !time) {
        return true; // Show all rooms if no date/time filter
    }

    const requested = parseLocalDateTime(date, time);
    if (!requested) return true;

    for (const booking of bookings) {
        if (booking.roomId !== roomId) continue;
        const iv = bookingInterval(booking);
        if (!iv) continue;
        if (requested >= iv.start && requested < iv.end) {
            return false;
        }
    }

    return true;
}

// Open booking modal
function openBookingModal(roomId) {
    const user = getCurrentUser();
    if (!user) {
        pendingBookingRoomId = roomId;
        setFormError(document.getElementById('login-error'), '');
        openModal('login-modal');
        return;
    }

    const room = studyRooms.find(r => r.id === roomId);
    const modal = document.getElementById('booking-modal');
    const modalRoomInfo = document.getElementById('modal-room-info');

    document.getElementById('student-name').value = user.displayName || '';
    document.getElementById('student-id').value = user.studentId || '';

    modalRoomInfo.innerHTML = `
        <strong>${room.name}</strong><br>
        <small>Capacity: ${room.capacity} people • ${room.floor}</small>
    `;

    // Set default date/time from filters if available
    const dateFilter = document.getElementById('date-filter').value;
    const timeFilter = document.getElementById('time-filter').value;
    
    if (dateFilter) {
        document.getElementById('booking-date').value = dateFilter;
    }
    if (timeFilter) {
        document.getElementById('booking-time').value = timeFilter;
    }

    // Store room ID in form
    document.getElementById('booking-form').dataset.roomId = roomId;
    
    modal.classList.add('active');
}

// Handle booking form submission
function handleBookingSubmit(e) {
    e.preventDefault();

    const roomId = parseInt(e.target.dataset.roomId);
    const date = document.getElementById('booking-date').value;
    const startTime = document.getElementById('booking-time').value;
    const duration = parseInt(document.getElementById('booking-duration').value);
    const studentName = document.getElementById('student-name').value;
    const studentId = document.getElementById('student-id').value;

    // Validate booking
    if (!validateBooking(roomId, date, startTime, duration)) {
        return;
    }

    const user = getCurrentUser();
    if (!user) {
        alert('Please log in to book a room.');
        return;
    }

    // Create booking
    const booking = {
        id: Date.now(),
        userId: user.id,
        roomId: roomId,
        roomName: studyRooms.find(r => r.id === roomId).name,
        date: date,
        startTime: startTime,
        duration: duration,
        studentName: studentName,
        studentId: studentId,
        createdAt: new Date().toISOString()
    };

    // Save booking
    const bookings = getBookings();
    bookings.push(booking);
    saveBookings(bookings);

    // Show success message
    showSuccessMessage('Booking confirmed successfully!');

    // Close modal and reset form
    document.getElementById('booking-modal').classList.remove('active');
    e.target.reset();

    // Refresh displays
    renderRooms();
    if (document.getElementById('bookings-section').classList.contains('active')) {
        renderBookings();
    }
}

// Validate booking
function validateBooking(roomId, date, startTime, duration) {
    const newStart = parseLocalDateTime(date, startTime);
    if (!newStart) {
        alert('Invalid date or time.');
        return false;
    }
    const newEnd = new Date(newStart.getTime() + Number(duration) * 3600000);
    if (!Number.isFinite(newEnd.getTime())) {
        alert('Invalid duration.');
        return false;
    }

    const bookings = getBookings();
    for (const booking of bookings) {
        if (booking.roomId !== roomId) continue;
        const iv = bookingInterval(booking);
        if (!iv) continue;
        if (intervalsOverlap(newStart, newEnd, iv.start, iv.end)) {
            alert('This time slot is already booked. Please choose another time.');
            return false;
        }
    }

    if (newStart < new Date()) {
        alert('Cannot book a room in the past. Please select a future date and time.');
        return false;
    }

    return true;
}

// Render bookings
function renderBookings() {
    const bookingsList = document.getElementById('bookings-list');
    const noBookings = document.getElementById('no-bookings');
    const user = getCurrentUser();

    bookingsList.innerHTML = '';

    if (!user) {
        noBookings.style.display = 'block';
        noBookings.innerHTML =
            '<p>Log in to see your bookings.</p><p>Use <strong>Log in</strong> or <strong>Sign up</strong> in the header.</p>';
        return;
    }

    noBookings.innerHTML =
        "<p>You don't have any bookings yet.</p><p>Start by booking a room from the \"Available Rooms\" tab!</p>";

    const bookings = getMyBookings();

    if (bookings.length === 0) {
        noBookings.style.display = 'block';
        return;
    }

    noBookings.style.display = 'none';

    const sortedBookings = [...bookings].sort((a, b) => {
        const ta = parseLocalDateTime(a.date, a.startTime);
        const tb = parseLocalDateTime(b.date, b.startTime);
        const aMs = ta ? ta.getTime() : 0;
        const bMs = tb ? tb.getTime() : 0;
        return aMs - bMs;
    });

    sortedBookings.forEach(booking => {
        const bookingDate = new Date(booking.date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const bookingCard = document.createElement('div');
        bookingCard.className = 'booking-card';
        bookingCard.innerHTML = `
            <div class="booking-info">
                <div class="booking-room">${escapeHtml(booking.roomName)}</div>
                <div class="booking-details">📅 ${escapeHtml(bookingDate)}</div>
                <div class="booking-details">🕐 ${escapeHtml(formatBookingRange(booking))} (${escapeHtml(booking.duration)} hour${booking.duration > 1 ? 's' : ''})</div>
                <div class="booking-details">👤 ${escapeHtml(booking.studentName)} (ID: ${escapeHtml(booking.studentId)})</div>
            </div>
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-danger';
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancel Booking';
        const bookingIdNum = Number(booking.id);
        cancelBtn.addEventListener('click', () => {
            if (Number.isFinite(bookingIdNum)) cancelBooking(bookingIdNum);
        });
        bookingCard.appendChild(cancelBtn);

        bookingsList.appendChild(bookingCard);
    });
}

function localDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatTimeFromDate(dateObj) {
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    return formatTime(`${hh}:${mm}`);
}

/** e.g. "11:00 PM – 1:00 AM (Sat, Jan 4)" when end is the next calendar day */
function formatBookingRange(booking) {
    const iv = bookingInterval(booking);
    if (!iv) return formatTime(booking.startTime) + ' – ?';
    const startLabel = formatTime(booking.startTime);
    const endLabel = formatTimeFromDate(iv.end);
    if (localDateKey(iv.start) === localDateKey(iv.end)) {
        return `${startLabel} – ${endLabel}`;
    }
    const endDatePretty = iv.end.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
    return `${startLabel} – ${endLabel} (${endDatePretty})`;
}

// Format time for display
function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Cancel booking
function cancelBooking(bookingId) {
    const user = getCurrentUser();
    if (!user) {
        alert('Please log in to manage bookings.');
        return;
    }

    const bookings = getBookings();
    const target = bookings.find((b) => b.id === bookingId);
    if (!target || target.userId !== user.id) {
        alert('You can only cancel your own bookings.');
        return;
    }

    if (!confirm('Are you sure you want to cancel this booking?')) {
        return;
    }

    const filteredBookings = bookings.filter(b => b.id !== bookingId);
    saveBookings(filteredBookings);

    showSuccessMessage('Booking cancelled successfully!');
    renderBookings();
    renderRooms();
}

// Clear filters
function clearFilters() {
    document.getElementById('capacity-filter').value = 'all';
    document.getElementById('date-filter').value = '';
    document.getElementById('time-filter').value = '';
    renderRooms();
}

// Show success message
function showSuccessMessage(message) {
    // Remove existing success message if any
    const existing = document.querySelector('.success-message');
    if (existing) {
        existing.remove();
    }

    const successMsg = document.createElement('div');
    successMsg.className = 'success-message';
    successMsg.textContent = message;
    
    const container = document.querySelector('.container');
    container.insertBefore(successMsg, container.firstChild);

    setTimeout(() => {
        successMsg.remove();
    }, 3000);
}

// LocalStorage functions — all bookings shared for room availability; "My Bookings" filters by userId
function getBookings() {
    const bookingsJson = localStorage.getItem(STORAGE_BOOKINGS);
    return bookingsJson ? JSON.parse(bookingsJson) : [];
}

function getMyBookings() {
    const user = getCurrentUser();
    if (!user) return [];
    return getBookings().filter((b) => b.userId === user.id);
}

function saveBookings(bookings) {
    localStorage.setItem(STORAGE_BOOKINGS, JSON.stringify(bookings));
}

function loadBookings() {
    // Bookings are loaded automatically when needed
    renderBookings();
}

