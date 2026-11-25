// استدعاء خدمات Firebase
import "./module.js";

let currentUser = null;
let employeeData = null; // تخزين بيانات الموظف الثابتة
let userLogs = [];

const monthNames = [
  "يناير (1)", "فبراير (2)", "مارس (3)", "أبريل (4)",
  "مايو (5)", "يونيو (6)", "يوليو (7)", "أغسطس (8)",
  "سبتمبر (9)", "أكتوبر (10)", "نوفمبر (11)", "ديسمبر (12)"
];
const ALLOWED_ADMIN_EMAIL = "admin@ess.system";

function formatTimeForDisplay(time24) {
  if (!time24) return "";

  const [hours, minutes] = time24.split(":");

  const date = new Date();
  date.setHours(Number(hours));
  date.setMinutes(Number(minutes));

  return date.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

document.getElementById('entryDate').valueAsDate = new Date();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (user.email === ALLOWED_ADMIN_EMAIL) {
      window.location.href = "admin.html";
      return;
    }

    currentUser = user;
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('attendanceContainer').classList.remove('hidden');

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
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('attendanceContainer').classList.add('hidden');
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
  document.getElementById('errorSection').style.display = 'none';
  document.getElementById('attendanceContainer').style.display = 'none';
  document.getElementById('loadingSection').style.display = 'block';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) return alert('يرجى إدخال البريد الإلكتروني وكلمة المرور');

  try {
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById('loadingSection').style.display = 'none';
    document.getElementById('attendanceContainer').style.display = 'block';
  } catch (error) {
    console.error("خطأ تسجيل الدخول:", error);
    document.getElementById('loadingSection').style.display = 'none';
    document.getElementById('errorSection').style.display = 'block';
  }
};

// 2. تسجيل الخروج
window.logout = function () {
  signOut(auth);
};

window.checkIn = async function () {
  if (!employeeData?.employeeCode) {
    return alert("لم يتم تحميل بيانات الموظف بعد");
  }
  const selectedDate =
    document.getElementById("entryDate").value;
  const now = new Date();

  const time = document.getElementById('checkInTime').value;

  await setDoc(
    doc(db, "attendance", `${employeeData.employeeCode}_${selectedDate}`),
    {
      userId: employeeData.employeeCode,
      date: selectedDate,
      checkIn: time,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      timestamp: now
    },
    { merge: true }
  );

  alert("تم تسجيل الحضور");
  loadLogs();
};
window.checkOut = async function () {
  if (!employeeData?.employeeCode) {
    return alert("لم يتم تحميل بيانات الموظف بعد");
  }
  const selectedDate =
    document.getElementById("entryDate").value;

  const time = document.getElementById('checkOutTime').value;

  await setDoc(
    doc(db, "attendance", `${employeeData.employeeCode}_${selectedDate}`),
    {
      checkOut: time
    },
    { merge: true }
  );

  alert("تم تسجيل الانصراف");
  loadLogs();
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

    userLogs.sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    populateYearSelector();
    renderLogList();

  } catch (e) {
    console.error("خطأ تحميل السجلات:", e);
    list.innerHTML = '<li>حدث خطأ أثناء تحميل السجلات.</li>';
  }
}
function getShiftName(id) {
  const shift = SHIFTS.find(s => s.id === id);

  if (!shift) return "-";

  return `${new Date(`2000-01-01T${shift.start}`).toLocaleTimeString("ar-EG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })} → ${new Date(`2000-01-01T${shift.end}`).toLocaleTimeString("ar-EG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })}`;
}
function renderLogList() {
  const selectedMonth =
    parseInt(document.getElementById("monthSelect").value);

  const selectedYear =
    parseInt(document.getElementById("yearSelect").value);


  const filteredLogs = userLogs.filter(log =>
    log.month === selectedMonth &&
    log.year === selectedYear
  );

  const list = document.getElementById("logList");
  list.innerHTML = "";

  if (filteredLogs.length === 0) {
    list.innerHTML = "<li>لا توجد سجلات لهذا الشهر.</li>";
    return;
  }

  filteredLogs.forEach((data) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>التاريخ:</strong> ${data.formattedDate} | <strong>حضور:</strong> ${formatTimeForDisplay(data.checkIn)} | <strong>انصراف:</strong> ${data.checkOut ? formatTimeForDisplay(data.checkOut) : '<span style="color:#dc3545;">لم يسجل بعد</span>'} | <strong>الشيفت:</strong> ${getShiftName(data.shiftDetected)} | <strong style="color:#dc3545;">التأخير:</strong> ${data.lateMinutes ?? 0} دقيقة | <strong style="color:#198754;">الإضافي:</strong> ${data.overtimeMinutes ?? 0} دقيقة`;
    list.appendChild(li);
  });
}

document.getElementById("monthSelect")
  .addEventListener("change", renderLogList);

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
    const checkOutStr = row.checkOut
      ? formatTimeForDisplay(row.checkOut)
      : 'لم يسجل انصراف';
    csvContent += `"${empCode}","${empName}","${empJob}","${empEmail}","${row.formattedDate}","${formatTimeForDisplay(row.checkIn)}","${checkOutStr}"\n`;
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

const SHIFTS = [
  { id: 1, start: "08:00", end: "16:30" },
  { id: 2, start: "12:00", end: "20:30" },
  { id: 3, start: "14:00", end: "22:30" }
];
const GRACE_PERIOD = 15; // ربع ساعة سماحية
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m}`;
}
function detectShift(checkIn) {

  const checkInMinutes = timeToMinutes(checkIn);

  let bestShift = null;
  let smallestDiff = Infinity;

  Object.entries(SHIFTS).forEach(([shiftId, shift]) => {

    const shiftStart = timeToMinutes(shift.start);

    const diff = Math.abs(
      checkInMinutes - shiftStart
    );

    if (diff < smallestDiff) {
      smallestDiff = diff;
      bestShift = shift.id;
    }

  });

  return bestShift;
}
function calculateAttendance(checkIn, checkOut, shiftId) {

  const shift = SHIFTS.find(s => s.id === shiftId);

  const start = timeToMinutes(shift.start);
  const end = timeToMinutes(shift.end);

  const inTime = timeToMinutes(checkIn);
  const outTime = timeToMinutes(checkOut);

  const lateArrival =
    Math.max(
      0,
      inTime - (start + GRACE_PERIOD)
    );

  const earlyLeave =
    Math.max(
      0,
      end - outTime
    );

  const overtime =
    Math.max(
      0,
      outTime - end
    );

  return {
    shiftId,
    lateMinutes:
      lateArrival + earlyLeave,
    overtimeMinutes:
      overtime
  };
}
async function recalculateAttendance() {


  const snapshot =
    await getDocs(
      collection(db, "attendance")
    );

  for (const docSnap of snapshot.docs) {

    const data = docSnap.data();

    if (data.attendanceCalculated)
      continue;

    if (!data.checkIn)
      continue;

    if (!data.checkOut)
      continue;

    const shiftId =
      detectShift(data.checkIn);

    const result =
      calculateAttendance(
        data.checkIn,
        data.checkOut,
        shiftId
      );

    await setDoc(
      doc(db, "attendance", docSnap.id),
      {
        shiftDetected:
          result.shiftId,

        lateMinutes:
          result.lateMinutes,

        overtimeMinutes:
          result.overtimeMinutes,

        attendanceCalculated:
          true
      },
      {
        merge: true
      }
    );

    console.log(
      "Processed:",
      docSnap.id
    );
  }

}
window.addEventListener(
  "DOMContentLoaded",
  async () => {

    try {

      await recalculateAttendance();

    } catch (err) {

      console.error(
        "Audit Error",
        err
      );

    }

  }
);