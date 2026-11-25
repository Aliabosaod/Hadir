let currentUser = null;
let employeeData = null; // تخزين بيانات الموظف الثابتة
let userLogs = [];

const monthNames = [
  "يناير (1)", "فبراير (2)", "مارس (3)", "أبريل (4)",
  "مايو (5)", "يونيو (6)", "يوليو (7)", "أغسطس (8)",
  "سبتمبر (9)", "أكتوبر (10)", "نوفمبر (11)", "ديسمبر (12)"
];
const ALLOWED_ADMIN_EMAIL = "admin@ess.system";

document.getElementById('entryDate').valueAsDate = new Date();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (user.email === ALLOWED_ADMIN_EMAIL) {
      window.location.href = "admin.html";
      return;
    }

    currentUser = user;
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('attendanceSection').classList.remove('hidden');

    // جلب بيانات الموظف الثابتة من مجموعة employees
    await loadEmployeeProfile();

    if (employeeData && employeeData.employeeCode) {
      loadLogs();
    } else {
      alert("لم يتم العثور على بيانات الموظف في مستند employees (كود الموظف مفقود).");
    }
  } else {
    currentUser = null;
    employeeData = null;
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('attendanceSection').classList.add('hidden');
  }
});

// جلب بيانات الموظف من مجموعة employees باستعلام البريد أو الـ ID
async function loadEmployeeProfile() {
  try {
    // البحث بالبريد الإلكتروني في مجموعة employees
    const q = query(collection(db, "employees"), where("userEmail", "==", currentUser.email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      employeeData = querySnapshot.docs[0].data();
    } else {
      // محاولة البحث باسم المستند مباشرة إذا كان معرفاً بالـ email أو UID
      const docRef = doc(db, "employees", currentUser.email);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        employeeData = docSnap.data();
      }
    }

    if (employeeData) {
      document.getElementById('userDisplay').textContent = employeeData.name || currentUser.email;
      document.getElementById('empCodeDisplay').textContent = employeeData.employeeCode || "غير محدد";
      document.getElementById('empJobDisplay').textContent = employeeData.jobTitle || "غير محدد";
    } else {
      document.getElementById('userDisplay').textContent = currentUser.email;
      document.getElementById('empCodeDisplay').textContent = "مفقود";
      document.getElementById('empJobDisplay').textContent = "مفقود";
    }
  } catch (e) {
    console.error("خطأ جلب بيانات الموظف:", e);
  }
}

// 1. تسجيل الدخول
window.login = async function () {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) return alert('يرجى إدخال البريد الإلكتروني وكلمة المرور');

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("خطأ تسجيل الدخول:", error);
    alert('بيانات الدخول غير صحيحة أو الحساب غير موجود.');
  }
};

// 2. تسجيل الخروج
window.logout = function () {
  signOut(auth);
};

function formatTimeTo12Hour(timeStr) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':');
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  const formattedHour = h < 10 ? '0' + h : h;
  return `${formattedHour}:${minutes} ${ampm}`;
}

// 3. حفظ سجل الحضور باستخدام كود الموظف كـ userId
window.saveAttendanceRecord = async function () {
  if (!currentUser || !employeeData || !employeeData.employeeCode) {
    return alert("تعذر الحفظ: كود الموظف غير متوفر في مستند employees.");
  }

  const dateVal = document.getElementById('entryDate').value;
  const checkInVal = document.getElementById('checkInTime').value;
  const checkOutVal = document.getElementById('checkOutTime').value;

  if (!dateVal) return alert("يرجى اختيار التاريخ.");
  if (!checkInVal) return alert("يرجى إدخال وقت الحضور على الأقل.");

  const selectedDate = new Date(dateVal);

  const docId = `${employeeData.employeeCode}_${dateVal}`;

  const checkInFormatted = formatTimeTo12Hour(checkInVal);
  const checkOutFormatted = checkOutVal ? formatTimeTo12Hour(checkOutVal) : null;

  try {
    // حفظ المستند بنظافة: userId يحتوي كود الموظف فقط وبدون name أو userEmail
    await setDoc(doc(db, "attendance", docId), {
      userId: employeeData.employeeCode, // كود الموظف
      date: dateVal,
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1,
      day: selectedDate.getDate(),
      checkIn: checkInFormatted,
      checkOut: checkOutFormatted,
      timestamp: selectedDate,
      createdAt: new Date()
    });

    alert("تم حفظ السجل بنجاح!");
    document.getElementById('checkInTime').value = '';
    document.getElementById('checkOutTime').value = '';
    loadLogs();
  } catch (e) {
    console.error("خطأ الحفظ:", e);
    alert("حدث خطأ أثناء حفظ السجل.");
  }
};

// 4. تحميل السجلات باستخدام كود الموظف (userId)
async function loadLogs() {
  if (!employeeData || !employeeData.employeeCode) return;
  const list = document.getElementById('logList');
  list.innerHTML = 'جاري التحميل...';

  try {
    // البحث بـ userId الذى يمثل كود الموظف
    const q = query(
      collection(db, "attendance"),
      where("userId", "==", employeeData.employeeCode)
    );
    const querySnapshot = await getDocs(q);

    userLogs = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      let dateObj;

      if (data.timestamp && typeof data.timestamp.toDate === 'function') {
        dateObj = data.timestamp.toDate();
      } else if (data.timestamp && data.timestamp.seconds) {
        dateObj = new Date(data.timestamp.seconds * 1000);
      } else if (data.date) {
        dateObj = new Date(data.date);
      } else {
        dateObj = new Date();
      }

      data.year = data.year || dateObj.getFullYear();
      data.month = data.month || (dateObj.getMonth() + 1);

      data.formattedDate = data.date || 'تاريخ غير محدد';

      userLogs.push(data);
    });

    userLogs.sort((a, b) => {
      const timeA = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate().getTime() : (a.timestamp && a.timestamp.seconds ? a.timestamp.seconds * 1000 : 0);
      const timeB = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate().getTime() : (b.timestamp && b.timestamp.seconds ? b.timestamp.seconds * 1000 : 0);
      return timeB - timeA;
    });

    renderLogList();
    populateYearSelector();

  } catch (e) {
    console.error("خطأ تحميل السجلات:", e);
    list.innerHTML = '<li>حدث خطأ أثناء تحميل السجلات.</li>';
  }
}

function renderLogList() {
  const list = document.getElementById('logList');
  list.innerHTML = '';

  if (userLogs.length === 0) {
    list.innerHTML = '<li>لا توجد سجلات سابقة لك.</li>';
    return;
  }

  userLogs.forEach((data) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>التاريخ:</strong> ${data.formattedDate} | <strong>حضور:</strong> ${data.checkIn} | <strong>انصراف:</strong> ${data.checkOut || '<span style="color:#dc3545;">لم يسجل بعد</span>'}`;
    list.appendChild(li);
  });
}

function populateYearSelector() {
  const yearSelect = document.getElementById('yearSelect');
  const currentYear = new Date().getFullYear();

  const availableYears = [...new Set(userLogs.map(log => log.year))];
  if (availableYears.length === 0) availableYears.push(currentYear);
  availableYears.sort((a, b) => b - a);

  yearSelect.innerHTML = '';
  availableYears.forEach(year => {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year;
    if (year === currentYear) opt.selected = true;
    yearSelect.appendChild(opt);
  });

  window.updateMonthSelector();
}

window.updateMonthSelector = function () {
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  const selectedYear = parseInt(yearSelect.value);

  const logsInYear = userLogs.filter(log => log.year === selectedYear);
  const availableMonths = [...new Set(logsInYear.map(log => log.month))];
  availableMonths.sort((a, b) => a - b);

  monthSelect.innerHTML = '';

  if (availableMonths.length === 0) {
    const opt = document.createElement('option');
    opt.value = "";
    opt.textContent = "لا توجد شهور مسجلة";
    monthSelect.appendChild(opt);
    return;
  }

  availableMonths.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = monthNames[m - 1];
    monthSelect.appendChild(opt);
  });
};

// 5. تصدير التقرير (يتم دمج البيانات الثابتة من الموظف مع سجل الحضور)
window.exportToExcel = function () {
  const selectedMonth = parseInt(document.getElementById('monthSelect').value);
  const selectedYear = parseInt(document.getElementById('yearSelect').value);

  if (!selectedMonth) {
    return alert("يرجى اختيار شهر يحتوي على سجلات لتصديره.");
  }

  const filteredLogs = userLogs.filter(log => log.month === selectedMonth && log.year === selectedYear);

  if (filteredLogs.length === 0) {
    return alert(`لا توجد سجلات حضور مسجلة لشهر (${selectedMonth}) سنة (${selectedYear})`);
  }

  let csvContent = "\uFEFF";
  csvContent += "كود الموظف,الاسم,الوظيفة,البريد الإلكتروني,التاريخ,وقت الحضور,وقت الانصراف\n";

  const empCode = employeeData ? employeeData.employeeCode : '';
  const empName = employeeData ? employeeData.name : '';
  const empJob = employeeData ? employeeData.jobTitle : '';
  const empEmail = currentUser ? currentUser.email : '';

  filteredLogs.forEach(row => {
    const checkOutStr = row.checkOut ? row.checkOut : 'لم يسجل انصراف';
    csvContent += `"${empCode}","${empName}","${empJob}","${empEmail}","${row.formattedDate}","${row.checkIn}","${checkOutStr}"\n`;
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const fileName = `تقرير_حضور_${empCode}_${selectedMonth}_${selectedYear}.csv`;

  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);

  link.click();
  document.body.removeChild(link);
};