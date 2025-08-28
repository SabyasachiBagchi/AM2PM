// app.js — Firebase-integrated version for AM2PM (use as a module script)

/* 1) Firebase SDK (CDN modular) */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

/* 2) Your Firebase config */
const firebaseConfig = {
  apiKey: "AIzaSyCCh25_zp7hIkWEmRhOgUejqMfQhe5lnBs",
  authDomain: "am2pm-ecdb4.firebaseapp.com",
  projectId: "am2pm-ecdb4",
  storageBucket: "am2pm-ecdb4.firebasestorage.app",
  messagingSenderId: "237983268562",
  appId: "1:237983268562:web:22b0194edda7f944dbb70b",
  measurementId: "G-8MXP4HG6JH"
};

/* 3) Initialize Firebase (App, Auth, Firestore) */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* 4) Main Application */
document.addEventListener('DOMContentLoaded', () => {
  class FoodServiceApp {
    constructor() {
      // Firebase handles
      this.auth = auth;
      this.db = db;

      // State
      this.isAdmin = false;
      this.currentUser = '';
      this.loggedInUser = '';
      this.currentUserId = null;
      this.currentDate = new Date();
      this.selectedDate = null;
      this.editingPaymentId = null;

      // Data (now synced via Firestore listeners)
      this.users = ["Abid Hossain", "Ahsan Ansari"];
      this.mealRate = 45;
      this.mealData = {};     // keyed by date: { 'YYYY-MM-DD': { lunch: bool, dinner: bool } }
      this.paymentData = [];  // array of { id, amount, date, updatedAt }

      // Listeners
      this.mealUnsub = null;
      this.paymentUnsub = null;

      this.init();
    }

    /* ---------- INIT & UI WIRING ---------- */
    init() {
      this.mainContent = document.getElementById('main-content');
      this.bindEvents();
      this.applyTheme();
      this.startClock();
      this.initParticles();
      this.setupAuthWatcher();
    }

    bindEvents() {
      // Login
      const loginForm = document.getElementById('loginForm');
      if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          await this.handleLogin();
        });
      }

      // View only
      const viewOnlyBtn = document.getElementById('viewOnlyBtn');
      if (viewOnlyBtn) viewOnlyBtn.addEventListener('click', () => this.handleViewOnly());

      // Logout
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

      // User select (admin only, left in place for UI parity)
      const userSelect = document.getElementById('userSelect');
      if (userSelect) {
        userSelect.addEventListener('change', e => {
          this.currentUser = e.target.value;
          this.renderDashboardView();
        });
      }

      // Theme
      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) themeToggle.addEventListener('change', e => this.toggleTheme(e.target.checked));

      // Main content clicks
      this.mainContent.addEventListener('click', (e) => {
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

      // Meal toggle changes
      this.mainContent.addEventListener('change', (e) => {
        if (e.target.id === 'lunchToggle') this.updateMealStatus('lunch', e.target.checked);
        if (e.target.id === 'dinnerToggle') this.updateMealStatus('dinner', e.target.checked);
      });

      // Payment submit
      this.mainContent.addEventListener('submit', (e) => {
        if (e.target.id === 'paymentForm') {
          e.preventDefault();
          this.handlePaymentFormSubmit();
        }
      });

      // FAB
      const fab = document.getElementById('fab');
      if (fab) {
        fab.addEventListener('click', (e) => {
          const fabMenu = document.getElementById('fabMenu');
          if (e.target.closest('#fabBtn')) fabMenu.classList.toggle('hidden');
          if (e.target.closest('#addPaymentBtn')) {
            this.renderPaymentView();
            fabMenu.classList.add('hidden');
          }
        });
      }
    }

    /* ---------- AUTH ---------- */
    setupAuthWatcher() {
      onAuthStateChanged(this.auth, (user) => {
        if (user) {
          this.currentUserId = user.uid;
          this.loggedInUser = user.email || 'User';
          document.getElementById('currentUser').textContent = `Logged in: ${this.loggedInUser}`;
          this.showApp(true);
          this.startDataListeners();     // meals + payments listeners
        } else {
          this.currentUserId = null;
          this.loggedInUser = '';
          this.stopDataListeners();
          this.showLogin();
        }
      });
    }

    async handleLogin() {
      const email = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const errDiv = document.getElementById('loginError');
      errDiv.classList.add('hidden');
      errDiv.textContent = '';

      try {
        await signInWithEmailAndPassword(this.auth, email, password);
        // UI will update from onAuthStateChanged
      } catch (error) {
        let msg = 'Login failed. Please try again.';
        if (error.code === 'auth/user-not-found') msg = 'No account found with this email.';
        if (error.code === 'auth/wrong-password') msg = 'Incorrect password.';
        if (error.code === 'auth/invalid-email') msg = 'Invalid email address.';
        errDiv.textContent = msg;
        errDiv.classList.remove('hidden');
      }
    }

    async logout() {
      try {
        await fbSignOut(this.auth);
      } catch (e) {
        console.warn('Logout error', e);
      }
    }

    handleViewOnly() {
      this.loggedInUser = 'View Only';
      this.showApp(false);
    }

    showLogin() {
      const modal = document.getElementById('loginModal');
      const app = document.getElementById('app');
      if (modal) modal.style.display = 'flex';
      if (app) app.classList.add('hidden');
    }

    showApp(isAdmin) {
      this.isAdmin = isAdmin;
      this.currentUser = this.isAdmin ? this.loggedInUser : this.users;
      const modal = document.getElementById('loginModal');
      const appRoot = document.getElementById('app');
      if (modal) modal.style.display = 'none';
      if (appRoot) appRoot.classList.remove('hidden');
      const fab = document.getElementById('fab');
      if (fab) fab.classList.toggle('hidden', !this.isAdmin);

      const select = document.getElementById('userSelect');
      if (select) {
        select.innerHTML = this.users.map(u => `<option value="${u}" ${u === this.currentUser ? 'selected' : ''}>${u}</option>`).join('');
        select.disabled = !this.isAdmin && this.loggedInUser !== 'View Only';
      }

      this.renderDashboardView();
    }

    /* ---------- FIRESTORE (DATA) ---------- */
    startDataListeners() {
      if (!this.currentUserId) return;

      // Meals listener
      const mealsRef = collection(this.db, 'meals', this.currentUserId, 'dates');
      this.mealUnsub = onSnapshot(mealsRef, (snap) => {
        const next = {};
        snap.forEach(d => {
          next[d.id] = d.data();
        });
        this.mealData = next;
        this.refreshCurrentView();
      }, (err) => console.error('Meal listener error:', err));

      // Payments listener (ordered by updatedAt desc)
      const paymentsRef = collection(this.db, 'payments', this.currentUserId, 'records');
      const paymentsQ = query(paymentsRef, orderBy('updatedAt', 'desc'));
      this.paymentUnsub = onSnapshot(paymentsQ, (snap) => {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        this.paymentData = list;
        this.refreshCurrentView();
      }, (err) => console.error('Payment listener error:', err));
    }

    stopDataListeners() {
      if (this.mealUnsub) { this.mealUnsub(); this.mealUnsub = null; }
      if (this.paymentUnsub) { this.paymentUnsub(); this.paymentUnsub = null; }
    }

    async saveMeal(dateStr, mealType, status) {
      if (!this.currentUserId) return;
      const mealRef = doc(this.db, 'meals', this.currentUserId, 'dates', dateStr);
      await setDoc(mealRef, { [mealType]: status, updatedAt: serverTimestamp() }, { merge: true });
    }

    async savePayment(payment) {
      if (!this.currentUserId) return;
      const id = payment.id.toString();
      const ref = doc(this.db, 'payments', this.currentUserId, 'records', id);
      await setDoc(ref, { ...payment, updatedAt: serverTimestamp() }, { merge: true });
    }

    async deletePayment(paymentId) {
      if (!this.currentUserId) return;
      const ref = doc(this.db, 'payments', this.currentUserId, 'records', String(paymentId));
      await deleteDoc(ref);
    }

    /* ---------- UI LOGIC ---------- */
    refreshCurrentView() {
      if (this.selectedDate) this.renderDayDetailView();
      else this.renderDashboardView();
    }

    renderDashboardView() {
      const stats = this.calculateStats();
      this.mainContent.innerHTML = `
        <div class="dashboard-header">
          <h2>Dashboard</h2>
          <div class="navbar-controls">
            ${this.isAdmin ? `
              <select id="userSelect" class="form-control" style="width: auto; display: inline-block;">
                ${this.users.map(u => `<option value="${u}" ${u === this.currentUser ? 'selected' : ''}>${u}</option>`).join('')}
              </select>
            ` : ''}
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-content">
              <h3>৳${stats.balance}</h3>
              <p>Balance Remaining</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-content">
              <h3>৳${stats.spent}</h3>
              <p>Spent This Month</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💳</div>
            <div class="stat-content">
              <h3>৳${stats.paid}</h3>
              <p>Paid This Month</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🍽️</div>
            <div class="stat-content">
              <h3>${stats.meals}</h3>
              <p>Meals This Month</p>
            </div>
          </div>
        </div>

        <div class="calendar-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-16);">
            <h3>${this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
            <div>
              <button id="prevMonth" class="btn btn--icon">←</button>
              <button id="nextMonth" class="btn btn--icon">→</button>
            </div>
          </div>
          ${this.renderCalendar()}
        </div>
      `;
    }

    renderCalendar() {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - firstDay.getDay());

      let calendar = `
        <div class="calendar-grid">
          ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="calendar-day-header">${d}</div>`).join('')}
      `;

      for (let i = 0; i < 42; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateStr = this.getLocalISODate(currentDate);
        const isCurrentMonth = currentDate.getMonth() === month;
        const isToday = dateStr === this.getLocalISODate(new Date());
        const dayData = this.mealData[dateStr] || { lunch: false, dinner: false };

        calendar += `
          <div class="day-cell ${!isCurrentMonth ? 'empty' : ''} ${isToday ? 'today' : ''}"
               data-date="${dateStr}"
               ${!isCurrentMonth ? 'style="opacity: 0.3;"' : ''}>
            <span class="day-number">${currentDate.getDate()}</span>
            ${isCurrentMonth ? `
              <div class="meal-dots">
                ${dayData.lunch ? '<div class="meal-dot lunch"></div>' : ''}
                ${dayData.dinner ? '<div class="meal-dot dinner"></div>' : ''}
              </div>
            ` : ''}
          </div>
        `;
      }

      calendar += `</div>`;
      return calendar;
    }

    renderDayDetailView() {
      const dateStr = this.getLocalISODate(this.selectedDate);
      const dayData = this.mealData[dateStr] || { lunch: false, dinner: false };

      this.mainContent.innerHTML = `
        <div class="day-detail-header">
          <h2>${this.selectedDate.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })}</h2>
          <button id="backToCalendar" class="btn btn--outline">← Back to Calendar</button>
        </div>

        <div class="meal-cards">
          <div class="meal-card">
            <div class="meal-header">
              <h3>🥗 Lunch</h3>
              <span class="meal-cost">৳${this.mealRate}</span>
            </div>
            <div class="meal-toggle">
              <span class="toggle-label">Available</span>
              <label class="toggle-switch">
                <input type="checkbox" id="lunchToggle" ${dayData.lunch ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="meal-card">
            <div class="meal-header">
              <h3>🍽️ Dinner</h3>
              <span class="meal-cost">৳${this.mealRate}</span>
            </div>
            <div class="meal-toggle">
              <span class="toggle-label">Available</span>
              <label class="toggle-switch">
                <input type="checkbox" id="dinnerToggle" ${dayData.dinner ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div class="summary-card">
          <h3>Daily Summary</h3>
          <p><strong>Total Cost:</strong> ৳${(dayData.lunch ? this.mealRate : 0) + (dayData.dinner ? this.mealRate : 0)}</p>
          <p><strong>Meals Selected:</strong> ${[dayData.lunch && 'Lunch', dayData.dinner && 'Dinner'].filter(Boolean).join(', ') || 'None'}</p>
        </div>
      `;
    }

    renderPaymentView() {
      this.mainContent.innerHTML = `
        <div class="payment-header">
          <h2>Payment Management</h2>
        </div>

        <div class="payment-form-card">
          <h3>Add Payment</h3>
          <form id="paymentForm">
            <div class="form-group">
              <label for="paymentAmount">Amount (৳)</label>
              <input type="number" id="paymentAmount" class="form-control" required min="0" step="0.01">
            </div>
            <div class="form-group">
              <label for="paymentDate">Date</label>
              <input type="date" id="paymentDate" class="form-control" required>
            </div>
            <button type="submit" class="btn btn--primary">Save Payment</button>
          </form>
        </div>

        <div class="payment-history">
          <h3>Payment History</h3>
          <div id="paymentList">
            ${this.renderPaymentList()}
          </div>
        </div>
      `;
    }

    renderPaymentList() {
      if (!this.paymentData || this.paymentData.length === 0) {
        return '<p>No payments recorded.</p>';
      }
      return this.paymentData.map(p => `
        <div class="payment-item">
          <div>
            <strong>৳${p.amount}</strong>
            <span style="margin-left: var(--space-8); color: var(--color-text-secondary);">${p.date}</span>
          </div>
          <div class="payment-actions">
            <button class="btn btn--icon edit-btn" data-payment-id="${p.id}">✏️</button>
            <button class="btn btn--icon delete-btn" data-payment-id="${p.id}">🗑️</button>
          </div>
        </div>
      `).join('');
    }

    /* ---------- ACTION HANDLERS ---------- */
    updateMealStatus(meal, status) {
      if (!this.selectedDate) return;
      const dateStr = this.getLocalISODate(this.selectedDate);
      // Optimistic UI
      if (!this.mealData[dateStr]) this.mealData[dateStr] = { lunch: false, dinner: false };
      this.mealData[dateStr][meal] = status;
      this.renderDayDetailView();
      // Persist
      this.saveMeal(dateStr, meal, status).catch(err => console.error('Save meal error:', err));
    }

    async handlePaymentFormSubmit() {
      const amount = parseFloat(document.getElementById('paymentAmount').value);
      const date = document.getElementById('paymentDate').value;
      if (!amount || !date) return;

      const payment = { id: this.editingPaymentId || Date.now(), amount, date };
      // Optimistic UI
      if (this.editingPaymentId) {
        const idx = this.paymentData.findIndex(p => p.id == this.editingPaymentId);
        if (idx !== -1) this.paymentData[idx] = payment;
      } else {
        this.paymentData.unshift(payment);
      }
      this.updatePaymentList();

      // Persist
      await this.savePayment(payment);
      this.resetPaymentForm();
    }

    handleEditPayment(id) {
      const payment = this.paymentData.find(p => p.id == id);
      if (!payment) return;
      this.editingPaymentId = id;
      document.getElementById('paymentAmount').value = payment.amount;
      document.getElementById('paymentDate').value = payment.date;
    }

    async handleDeletePayment(id) {
      if (confirm('Delete this payment?')) {
        try {
          await this.deletePayment(id);
        } catch (e) {
          console.error('Delete payment error:', e);
        }
      }
    }

    resetPaymentForm() {
      this.editingPaymentId = null;
      document.getElementById('paymentAmount').value = '';
      document.getElementById('paymentDate').value = '';
    }

    updatePaymentList() {
      const list = document.getElementById('paymentList');
      if (list) list.innerHTML = this.renderPaymentList();
    }

    /* ---------- UTILITIES ---------- */
    calculateStats() {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      let meals = 0;
      let spent = 0;
      Object.keys(this.mealData).forEach(dateStr => {
        if (dateStr.startsWith(ym)) {
          const d = this.mealData[dateStr];
          if (d.lunch) { meals += 1; spent += this.mealRate; }
          if (d.dinner) { meals += 1; spent += this.mealRate; }
        }
      });

      let paid = 0;
      if (Array.isArray(this.paymentData)) {
        this.paymentData.forEach(p => {
          if (p.date && p.date.startsWith(ym)) paid += Number(p.amount || 0);
        });
      }

      return { meals, spent, paid, balance: paid - spent };
    }

    navigateMonth(dir) {
      this.currentDate.setMonth(this.currentDate.getMonth() + dir);
      this.renderDashboardView();
    }

    toggleTheme(isDark) {
      document.body.classList.toggle('dark-mode', isDark);
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    applyTheme() {
      const theme = localStorage.getItem('theme') || 'light';
      this.toggleTheme(theme === 'dark');
      const t = document.getElementById('themeToggle');
      if (t) t.checked = (theme === 'dark');
    }

    startClock() {
      const update = () => {
        const now = new Date();
        const ct = document.getElementById('clock-time');
        const cd = document.getElementById('clock-date');
        if (ct) ct.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (cd) cd.textContent = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      };
      update();
      setInterval(update, 1000);
    }

    initParticles() {
      if (typeof particlesJS !== 'undefined') {
        particlesJS('particles-js', {
          particles: {
            number: { value: 60, density: { enable: true, value_area: 800 } },
            color: { value: '#888888' },
            shape: { type: 'circle' },
            opacity: { value: 0.5, random: true },
            size: { value: 3, random: true },
            line_linked: { enable: true, distance: 150, color: '#888888', opacity: 0.4, width: 1 },
            move: { enable: true, speed: 4, direction: 'none', random: true, straight: false, out_mode: 'out', bounce: false }
          },
          interactivity: {
            detect_on: 'canvas',
            events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' }, resize: true },
            modes: { repulse: { distance: 100, duration: 0.4 }, push: { particles_nb: 4 } }
          },
          retina_detect: true
        });
      }
    }

    getLocalISODate(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Boot
  new FoodServiceApp();
});
