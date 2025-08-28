document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration with YOUR keys ---
    const firebaseConfig = {
      apiKey: "AIzaSyCCh25_zp7hIkWEmRhOgUejqMfQhe5lnBs",
      authDomain: "am2pm-ecdb4.firebaseapp.com",
      databaseURL: "https://am2pm-ecdb4-default-rtdb.firebaseio.com/",
      projectId: "am2pm-ecdb4",
      storageBucket: "am2pm-ecdb4.appspot.com",
      messagingSenderId: "237983268562",
      appId: "1:237983268562:web:22b0194edda7f944dbb70b"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();

    class FoodServiceApp {
        constructor() {
            this.isAdmin = false;
            this.currentUser = '';
            this.loggedInUser = '';
            this.currentDate = new Date();
            this.selectedDate = null;
            this.editingPaymentId = null;
            this.users = ["Abid Hossain", "Ahsan Ansari"];
            this.mealRate = 45;
            this.mealData = {};
            this.paymentData = {};
            
            this.init();
        }

        init() {
            this.mainContent = document.getElementById('main-content');
            this.bindEvents();
            this.applyTheme();
            this.startClock();
            this.initParticles(); // Initialize the cool background
        }

        async _loadData() {
            try {
                const snapshot = await database.ref().once('value');
                const data = snapshot.val() || {};
                this.mealData = data.mealData || { "Abid Hossain": {}, "Ahsan Ansari": {} };
                this.paymentData = data.paymentData || { "Abid Hossain": [], "Ahsan Ansari": [] };
            } catch (error) {
                console.error("Firebase load failed:", error);
                alert("Could not connect to the database. Check your internet and Firebase setup.");
            }
        }

        _saveMealData() { database.ref('mealData').set(this.mealData); }
        _savePaymentData() { database.ref('paymentData').set(this.paymentData); }
        
        bindEvents() {
            document.getElementById('loginForm').addEventListener('submit', async e => { 
                e.preventDefault(); 
                await this._loadData();
                this.handleLogin(); 
            });
            document.getElementById('viewOnlyBtn').addEventListener('click', async () => { 
                await this._loadData(); 
                this.handleViewOnly(); 
            });
            document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
            document.getElementById('userSelect').addEventListener('change', e => { this.currentUser = e.target.value; this.renderDashboardView(); });
            document.getElementById('themeToggle').addEventListener('change', e => this.toggleTheme(e.target.checked));
            
            this.mainContent.addEventListener('click', e => {
                if (e.target.closest('#prevMonth')) this.navigateMonth(-1);
                if (e.target.closest('#nextMonth')) this.navigateMonth(1);
                const dayCell = e.target.closest('.day-cell:not(.empty)');
                if (dayCell) {
                    const [year, month, day] = dayCell.dataset.date.split('-').map(Number);
                    this.selectedDate = new Date(year, month - 1, day); 
                    this.renderDayDetailView();
                }
                if (e.target.closest('#backToCalendar')) this.renderDashboardView();
                if (e.target.closest('.edit-btn')) this.handleEditPayment(e.target.closest('.edit-btn').dataset.paymentId);
                if (e.target.closest('.delete-btn')) this.handleDeletePayment(e.target.closest('.delete-btn').dataset.paymentId);
            });

            this.mainContent.addEventListener('change', e => {
                if (e.target.id === 'lunchToggle') this.updateMealStatus('lunch', e.target.checked);
                if (e.target.id === 'dinnerToggle') this.updateMealStatus('dinner', e.target.checked);
            });
            
            this.mainContent.addEventListener('submit', e => {
                if (e.target.id === 'paymentForm') { e.preventDefault(); this.handlePaymentFormSubmit(); }
            });

            const fab = document.getElementById('fab');
            fab.addEventListener('click', e => {
                const fabMenu = document.getElementById('fabMenu');
                if (e.target.closest('#fabBtn')) { fabMenu.classList.toggle('hidden'); }
                if (e.target.closest('#addPaymentBtn')) { this.renderPaymentView(); fabMenu.classList.add('hidden'); }
            });
        }
        
        toggleTheme(isDark) { 
            if (isDark) {
                document.body.classList.remove('light-mode');
            } else {
                document.body.classList.add('light-mode');
            }
            localStorage.setItem('theme', isDark ? 'dark' : 'light'); 
        }
        applyTheme() { const theme = localStorage.getItem('theme') || 'dark'; this.toggleTheme(theme === 'dark'); document.getElementById('themeToggle').checked = (theme === 'dark'); }
        startClock() { const update = () => { const now = new Date(); document.getElementById('clock-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); document.getElementById('clock-date').textContent = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }; update(); setInterval(update, 1000); }
        initParticles() { 
            particlesJS('particles-js', {
                "particles": { "number": { "value": 50 }, "color": { "value": "#ffffff" }, "shape": { "type": "circle" }, "opacity": { "value": 0.5, "random": true }, "size": { "value": 3, "random": true }, "line_linked": { "enable": true, "distance": 150, "color": "#ffffff", "opacity": 0.4, "width": 1 }, "move": { "enable": true, "speed": 2, "direction": "none", "out_mode": "out" } },
                "interactivity": { "events": { "onhover": { "enable": true, "mode": "repulse" }, "onclick": { "enable": true, "mode": "push" } } }
            });
        }

        handleLogin() {
            const user = document.getElementById('username').value; const pass = document.getElementById('password').value; const errDiv = document.getElementById('loginError');
            if ((user === 'AbidHossain' && pass === 'Abid@786') || (user === 'AhsanAnsari' && pass === 'Ahsan@786')) {
                this.loggedInUser = this.users.find(u => u.startsWith(user.replace('Hossain', '').replace('Ansari', '')));
                this.showApp(true);
            } else { errDiv.textContent = 'Invalid credentials.'; errDiv.classList.remove('hidden'); }
        }
        handleViewOnly() { this.loggedInUser = 'View Only'; this.showApp(false); }
        showApp(isAdmin) {
            this.isAdmin = isAdmin; this.currentUser = this.isAdmin ? this.loggedInUser : this.users[0];
            document.getElementById('loginModal').style.display = 'none'; document.getElementById('app').classList.remove('hidden');
            document.getElementById('currentUser').textContent = `Logged in: ${this.loggedInUser}`;
            document.getElementById('fab').classList.toggle('hidden', !this.isAdmin);
            const select = document.getElementById('userSelect');
            select.innerHTML = this.users.map(u => `<option value="${u}" ${u === this.currentUser ? 'selected' : ''}>${u}</option>`).join('');
            select.disabled = !this.isAdmin && this.loggedInUser !== 'View Only';
            this.renderDashboardView();
        }
        logout() { location.reload(); }

        getLocalISODate(date) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }
        
        renderDashboardView() {
            const stats = this.calculateStats();
            this.mainContent.innerHTML = `
                <div id="dashboardView" class="view">
                    <div class="dashboard-header"><h1>Monthly Overview</h1><div class="month-nav"><button id="prevMonth" class="btn btn--outline"><i class="fas fa-chevron-left"></i></button><span id="currentMonth">${this.currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span><button id="nextMonth" class="btn btn--outline"><i class="fas fa-chevron-right"></i></button></div></div>
                    <div class="stats-grid">
                        <div class="stat-card glass-effect"><div class="stat-icon"><i class="fas fa-wallet"></i></div><div class="stat-content"><h3>₹${stats.balanceRemaining}</h3><p>Balance Remaining</p></div></div>
                        <div class="stat-card glass-effect"><div class="stat-icon"><i class="fas fa-rupee-sign"></i></div><div class="stat-content"><h3>₹${stats.spentThisMonth}</h3><p>Spent This Month</p></div></div>
                        <div class="stat-card glass-effect"><div class="stat-icon"><i class="fas fa-credit-card"></i></div><div class="stat-content"><h3>₹${stats.paidThisMonth}</h3><p>Paid This Month</p></div></div>
                        <div class="stat-card glass-effect"><div class="stat-icon"><i class="fas fa-utensils"></i></div><div class="stat-content"><h3>${stats.mealsThisMonth}</h3><p>Meals This Month</p></div></div>
                    </div>
                    <div class="calendar-section glass-effect"><div class="calendar-header"><h2>Meal Calendar</h2></div><div id="calendar" class="calendar-grid"></div></div>
                </div>`;
            this.renderCalendar();
        }
        renderCalendar() {
            const calEl = document.getElementById('calendar'); calEl.innerHTML = '';
            const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            daysOfWeek.forEach(day => calEl.innerHTML += `<div class="calendar-day-header">${day}</div>`);
            const year = this.currentDate.getFullYear(), month = this.currentDate.getMonth();
            const firstDay = new Date(year, month, 1), daysInMonth = new Date(year, month + 1, 0).getDate();
            const startDay = (firstDay.getDay() + 6) % 7;
            for (let i = 0; i < startDay; i++) calEl.innerHTML += `<div class="day-cell empty"></div>`;
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const dateStr = this.getLocalISODate(date);
                const dayData = this.mealData[this.currentUser]?.[dateStr];
                let classes = 'day-cell glass-effect', dots = '';
                if (dayData) { if (dayData.lunch) dots += '<div class="meal-dot lunch"></div>'; if (dayData.dinner) dots += '<div class="meal-dot dinner"></div>'; }
                if (date.toDateString() === new Date().toDateString()) classes += ' today';
                calEl.innerHTML += `<div class="${classes}" data-date="${dateStr}"><div class="day-number">${day}</div><div class="meal-dots">${dots}</div></div>`;
            }
        }
        renderDayDetailView() {
            const dateStr = this.getLocalISODate(this.selectedDate);
            const dayData = this.mealData[this.currentUser]?.[dateStr] || { lunch: false, dinner: false };
            const mealCount = (dayData.lunch ? 1 : 0) + (dayData.dinner ? 1 : 0);
            this.mainContent.innerHTML = `
                <div id="dayDetailView" class="view">
                    <div class="day-detail-header"><button id="backToCalendar" class="btn btn--outline"><i class="fas fa-arrow-left"></i> Back</button><h1>${this.selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h1></div>
                    <div class="meal-cards">
                        <div class="meal-card glass-effect"><div class="meal-header"><h3><i class="fas fa-sun"></i> Lunch</h3><div class="meal-cost">₹${this.mealRate}</div></div><div class="meal-toggle"><label class="toggle-switch"><input type="checkbox" id="lunchToggle" ${dayData.lunch ? 'checked' : ''} ${!this.isAdmin ? 'disabled' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">${dayData.lunch ? 'Eaten' : 'Skipped'}</span></div></div>
                        <div class="meal-card glass-effect"><div class="meal-header"><h3><i class="fas fa-moon"></i> Dinner</h3><div class="meal-cost">₹${this.mealRate}</div></div><div class="meal-toggle"><label class="toggle-switch"><input type="checkbox" id="dinnerToggle" ${dayData.dinner ? 'checked' : ''} ${!this.isAdmin ? 'disabled' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">${dayData.dinner ? 'Eaten' : 'Skipped'}</span></div></div>
                    </div>
                    <div class="day-summary"><div class="summary-card glass-effect"><h4>Daily Summary</h4><div class="summary-item"><span>Meals:</span><span>${mealCount}</span></div><div class="summary-item"><span>Cost:</span><span>₹${mealCount * this.mealRate}</span></div></div></div>
                </div>`;
        }
        renderPaymentView() {
            this.mainContent.innerHTML = `
                <div id="paymentView" class="view">
                    <div class="payment-header"><button id="backToCalendar" class="btn btn--outline"><i class="fas fa-arrow-left"></i> Back</button><h1>Payment Tracking</h1></div>
                    <div class="payment-form-card glass-effect"></div>
                    <div class="payment-history glass-effect"><h3>Payment History</h3><div id="paymentList" class="payment-list"></div></div>
                </div>`;
            this.resetPaymentForm();
            this.updatePaymentList();
        }

        navigateMonth(dir) { this.currentDate.setMonth(this.currentDate.getMonth() + dir); this.renderDashboardView(); }
        
        updateMealStatus(meal, status) {
            const dateStr = this.getLocalISODate(this.selectedDate);
            if (!this.mealData[this.currentUser]) this.mealData[this.currentUser] = {};
            if (!this.mealData[this.currentUser][dateStr]) this.mealData[this.currentUser][dateStr] = { lunch: false, dinner: false };
            this.mealData[this.currentUser][dateStr][meal] = status;
            this._saveMealData();
            this.renderDayDetailView();
        }
        
        calculateStats() {
            const meals = this.mealData[this.currentUser] || {};
            const payments = this.paymentData[this.currentUser] || [];
            let totalSpentAllTime = 0;
            for (const dateStr in meals) { if (meals[dateStr].lunch) totalSpentAllTime += this.mealRate; if (meals[dateStr].dinner) totalSpentAllTime += this.mealRate; }
            const totalPaidAllTime = payments.reduce((sum, p) => sum + p.amount, 0);
            const year = this.currentDate.getFullYear(), month = this.currentDate.getMonth();
            let mealsThisMonth = 0, spentThisMonth = 0;
            for (const dateStr in meals) {
                const d = new Date(dateStr);
                if (d.getUTCFullYear() === year && d.getUTCMonth() === month) {
                    if (meals[dateStr].lunch) { mealsThisMonth++; spentThisMonth += this.mealRate; }
                    if (meals[dateStr].dinner) { mealsThisMonth++; spentThisMonth += this.mealRate; }
                }
            }
            const paidThisMonth = payments.reduce((sum, p) => { const d = new Date(p.date); return (d.getUTCFullYear() === year && d.getUTCMonth() === month) ? sum + p.amount : sum; }, 0);
            const balanceRemaining = totalPaidAllTime - totalSpentAllTime;
            return { balanceRemaining, spentThisMonth, paidThisMonth, mealsThisMonth };
        }

        handlePaymentFormSubmit() {
            const amount = parseInt(document.getElementById('paymentAmount').value);
            const date = document.getElementById('paymentDate').value;
            if (!amount || !date) return;
            if (!this.paymentData[this.currentUser]) this.paymentData[this.currentUser] = [];
            
            if (this.editingPaymentId) {
                const paymentIndex = this.paymentData[this.currentUser].findIndex(p => p.id == this.editingPaymentId);
                if (paymentIndex > -1) {
                    this.paymentData[this.currentUser][paymentIndex].amount = amount;
                    this.paymentData[this.currentUser][paymentIndex].date = date;
                }
            } else {
                this.paymentData[this.currentUser].push({ id: Date.now(), amount, date });
            }
            this._savePaymentData();
            this.resetPaymentForm();
            this.updatePaymentList();
        }
        handleEditPayment(id) {
            this.editingPaymentId = id;
            const payment = this.paymentData[this.currentUser].find(p => p.id == id);
            document.getElementById('paymentFormTitle').textContent = 'Edit Payment';
            document.getElementById('paymentAmount').value = payment.amount;
            document.getElementById('paymentDate').value = payment.date;
        }
        handleDeletePayment(id) {
            if (confirm('Delete this payment?')) {
                this.paymentData[this.currentUser] = this.paymentData[this.currentUser].filter(p => p.id != id);
                this._savePaymentData();
                this.updatePaymentList();
            }
        }
        resetPaymentForm() {
            this.editingPaymentId = null;
            const formContainer = this.mainContent.querySelector('.payment-form-card');
            formContainer.innerHTML = `<h3 id="paymentFormTitle">Record Payment</h3><form id="paymentForm"><div class="form-group"><label>Amount</label><input type="number" id="paymentAmount" class="form-control" required></div><div class="form-group"><label>Date</label><input type="date" id="paymentDate" class="form-control" required></div><button type="submit" class="btn btn--primary">Save</button></form>`;
            document.getElementById('paymentDate').valueAsDate = new Date();
        }
        updatePaymentList() {
            const listEl = document.getElementById('paymentList');
            if (!listEl) return;
            listEl.innerHTML = '';
            const payments = this.paymentData[this.currentUser] || [];
            if (payments.length === 0) { listEl.innerHTML = '<p>No payments recorded.</p>'; return; }
            payments.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(p => {
                listEl.innerHTML += `<div class="payment-item"><div><strong>₹${p.amount}</strong><span> on ${new Date(p.date).toLocaleDateString()}</span></div><div class="payment-actions">${this.isAdmin ? `<button class="btn--icon edit-btn" data-payment-id="${p.id}"><i class="fas fa-edit"></i></button><button class="btn--icon delete-btn" data-payment-id="${p.id}"><i class="fas fa-trash"></i></button>` : ''}</div></div>`;
            });
        }
    }

    window.app = new FoodServiceApp();
});
