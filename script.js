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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-filter').min = today;
    document.getElementById('booking-date').min = today;

    // Load bookings from localStorage
    loadBookings();

    // Render rooms
    renderRooms();

    // Setup event listeners
    setupEventListeners();
});

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

    // Modal events
    const modal = document.getElementById('booking-modal');
    const closeBtn = document.querySelector('.close');
    
    closeBtn.addEventListener('click', () => {
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

    // Get bookings for the selected date
    const bookings = getBookings();
    const filteredBookings = dateFilter 
        ? bookings.filter(b => b.date === dateFilter)
        : bookings;

    roomsGrid.innerHTML = '';

    studyRooms.forEach(room => {
        // Apply capacity filter
        if (capacityFilter !== 'all') {
            const capacity = parseInt(capacityFilter);
            if (room.capacity < capacity || (capacity === 8 && room.capacity < 8)) {
                return;
            }
        }

        // Check availability
        const isAvailable = checkRoomAvailability(room.id, dateFilter, timeFilter, filteredBookings);

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

// Check if room is available at given date/time
function checkRoomAvailability(roomId, date, time, bookings) {
    if (!date || !time) {
        return true; // Show all rooms if no date/time filter
    }

    const bookingsForRoom = bookings.filter(b => b.roomId === roomId && b.date === date);
    
    if (bookingsForRoom.length === 0) {
        return true;
    }

    const requestedTime = timeToMinutes(time);
    
    // Check for conflicts
    for (const booking of bookingsForRoom) {
        const bookingStart = timeToMinutes(booking.startTime);
        const bookingEnd = bookingStart + (booking.duration * 60);
        
        if (requestedTime >= bookingStart && requestedTime < bookingEnd) {
            return false;
        }
    }

    return true;
}

// Convert time string to minutes
function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

// Open booking modal
function openBookingModal(roomId) {
    const room = studyRooms.find(r => r.id === roomId);
    const modal = document.getElementById('booking-modal');
    const modalRoomInfo = document.getElementById('modal-room-info');

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

    // Create booking
    const booking = {
        id: Date.now(),
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
    const bookings = getBookings();
    const conflictingBookings = bookings.filter(b => 
        b.roomId === roomId && 
        b.date === date
    );

    const requestedStart = timeToMinutes(startTime);
    const requestedEnd = requestedStart + (duration * 60);

    // Check for conflicts
    for (const booking of conflictingBookings) {
        const bookingStart = timeToMinutes(booking.startTime);
        const bookingEnd = bookingStart + (booking.duration * 60);

        if ((requestedStart >= bookingStart && requestedStart < bookingEnd) ||
            (requestedEnd > bookingStart && requestedEnd <= bookingEnd) ||
            (requestedStart <= bookingStart && requestedEnd >= bookingEnd)) {
            alert('This time slot is already booked. Please choose another time.');
            return false;
        }
    }

    // Check if booking is in the past
    const bookingDateTime = new Date(`${date}T${startTime}`);
    if (bookingDateTime < new Date()) {
        alert('Cannot book a room in the past. Please select a future date and time.');
        return false;
    }

    return true;
}

// Render bookings
function renderBookings() {
    const bookingsList = document.getElementById('bookings-list');
    const noBookings = document.getElementById('no-bookings');
    const bookings = getBookings();

    bookingsList.innerHTML = '';

    if (bookings.length === 0) {
        noBookings.style.display = 'block';
        return;
    }

    noBookings.style.display = 'none';

    // Sort bookings by date and time
    const sortedBookings = bookings.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
    });

    sortedBookings.forEach(booking => {
        const endTime = calculateEndTime(booking.startTime, booking.duration);
        const bookingDate = new Date(booking.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const bookingCard = document.createElement('div');
        bookingCard.className = 'booking-card';
        bookingCard.innerHTML = `
            <div class="booking-info">
                <div class="booking-room">${booking.roomName}</div>
                <div class="booking-details">📅 ${bookingDate}</div>
                <div class="booking-details">🕐 ${formatTime(booking.startTime)} - ${formatTime(endTime)} (${booking.duration} hour${booking.duration > 1 ? 's' : ''})</div>
                <div class="booking-details">👤 ${booking.studentName} (ID: ${booking.studentId})</div>
            </div>
            <button class="btn-danger" onclick="cancelBooking(${booking.id})">Cancel Booking</button>
        `;

        bookingsList.appendChild(bookingCard);
    });
}

// Calculate end time
function calculateEndTime(startTime, duration) {
    const start = timeToMinutes(startTime);
    const end = start + (duration * 60);
    const hours = Math.floor(end / 60);
    const minutes = end % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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
    if (!confirm('Are you sure you want to cancel this booking?')) {
        return;
    }

    const bookings = getBookings();
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

// LocalStorage functions
function getBookings() {
    const bookingsJson = localStorage.getItem('studyRoomBookings');
    return bookingsJson ? JSON.parse(bookingsJson) : [];
}

function saveBookings(bookings) {
    localStorage.setItem('studyRoomBookings', JSON.stringify(bookings));
}

function loadBookings() {
    // Bookings are loaded automatically when needed
    renderBookings();
}

