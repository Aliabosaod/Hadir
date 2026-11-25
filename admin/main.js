// استدعاء خدمات Firebase
import "./../module.js";
const ALLOWED_ADMIN_EMAIL = "admin@ess.system";
let employeesMap = {};
let allAttendanceLogs = [];

const STATUS_MAP = {
  weekly_off: "إجازة أسبوعية",
  annual_leave: "إجازة سنوية",
  official_leave: "إجازة رسمية",
  deduction_leave: "إجازة خصم",
  absence: "غياب",
  present: "حضور"
};

const monthNames = [
  "يناير (1)", "فبراير (2)", "مارس (3)", "أبريل (4)",
  "مايو (5)", "يونيو (6)", "يوليو (7)", "أغسطس (8)",
  "سبتمبر (9)", "أكتوبر (10)", "نوفمبر (11)", "ديسمبر (12)"
];

onAuthStateChanged(auth, async (user) => {
  if (user && user.email === ALLOWED_ADMIN_EMAIL) {
    await loadEmployees();
    await loadAllAttendance();
    setupDateSelectors();
  } else {
    window.location.href = "index.html";
  }
});

// --- دالة تحويل أي صيغة وقت إلى نظام 12 ساعة للعرض ---
function formatTimeTo12Hour(timeStr) {
  if (!timeStr || timeStr === '-' || timeStr.trim() === '') return '-';

  // إذا كان يحتوي مسبقاً على ص أو م أو AM / PM
  if (/[صمa-zA-Z]/.test(timeStr)) return timeStr;

  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;

  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].substring(0, 2);

  if (isNaN(hours)) return timeStr;

  const period = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  const formattedHours = String(hours).padStart(2, '0');
  return `${formattedHours}:${minutes} ${period}`;
}

// --- دوال تحويل أرقام إكسل لتاريخ ووقت عادي ---
function excelSerialToDate(serial) {
  if (!serial || isNaN(serial)) return serial;
  const num = parseFloat(serial);
  if (num < 1000) return serial; // ليس تاريخ إكسل (ربما نص عادي)

  const utc_days = Math.floor(num - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);

  const year = date_info.getFullYear();
  const month = String(date_info.getMonth() + 1).padStart(2, '0');
  const day = String(date_info.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function excelSerialToTime(serial) {
  if (serial === undefined || serial === null || serial === '' || serial === '-') return '-';

  // إذا كانت القيمة نص وقت عادي مثل "08:30" أو "14:15"
  if (typeof serial === 'string' && serial.includes(':')) {
    return formatTimeTo12Hour(serial);
  }

  const num = parseFloat(serial);
  if (isNaN(num)) return formatTimeTo12Hour(serial);

  // الحصول على الجزء العشري فقط للوقت
  const timeFraction = num % 1;
  let totalSeconds = Math.round(timeFraction * 86400);

  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);

  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');

  return formatTimeTo12Hour(`${formattedHours}:${formattedMinutes}`);
}

function generateRandomPassword() {
  const randomNumbers = Math.floor(100000 + Math.random() * 900000);
  return `ess#${randomNumbers}`;
}

// 1. إنشاء حساب الموظف
window.createEmployeeAccount = async function () {
  const code = document.getElementById('empCode').value.trim();
  const name = document.getElementById('empName').value.trim();
  const job = document.getElementById('empJob').value.trim();
  const email = document.getElementById('empEmail').value.trim().toLowerCase();

  if (!code || !name || !job || !email) {
    return alert("يرجى ملء جميع البيانات: الكود، الاسم، الوظيفة، والبريد الإلكتروني.");
  }

  const generatedPassword = generateRandomPassword();

  try {
    let secondaryApp;

    if (!getApps().some(app => app.name === "SecondaryApp")) {
      secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
    } else {
      secondaryApp = getApp("SecondaryApp");
    }
    const secondaryAuth = getAuth(secondaryApp);

    await createUserWithEmailAndPassword(secondaryAuth, email, generatedPassword);
    await secondaryAuth.signOut();

    await setDoc(doc(db, "employees", code), {
      employeeCode: code,
      name: name,
      jobTitle: job,
      userEmail: email
    });

    document.getElementById('createdEmail').textContent = email;
    document.getElementById('createdPassword').textContent = generatedPassword;
    document.getElementById('credentialsResult').classList.remove('hidden');

    alert(`تم إنشاء حساب الموظف ${name} بنجاح!`);
    document.getElementById('employeeForm').reset();
    await loadEmployees();

  } catch (e) {
    console.error("خطأ إنشاء الحساب:", e);
    if (e.code === 'auth/email-already-in-use') {
      alert("هذا البريد الإلكتروني مستخدم بالفعل.");
    } else {
      alert("حدث خطأ أثناء إنشاء الحساب: " + e.message);
    }
  }
};

window.copyPassword = function () {
  const pwd = document.getElementById('createdPassword').textContent;
  navigator.clipboard.writeText(pwd).then(() => {
    alert("تم نسخ كلمة المرور إلى الحافظة!");
  }).catch(err => {
    alert("تعذر النسخ تلقائياً، يمكنك نسخها يدوياً: " + pwd);
  });
};
function timeToMinutes(timeStr) {

  if (!timeStr || timeStr === "-")
    return null;

  const match =
    timeStr.match(/(\d+):(\d+)\s*(AM|PM|ص|م)/i);

  if (!match)
    return null;

  let h = parseInt(match[1]);
  let m = parseInt(match[2]);

  const period = match[3];

  if (period === "PM" || period === "م") {
    if (h !== 12) h += 12;
  } else {
    if (h === 12) h = 0;
  }

  return h * 60 + m;
}
function getShift(checkInMinutes) {

  if (checkInMinutes <= 11 * 60) {
    return {
      shift: "A",
      start: 480,   // 8:00
      end: 990      // 4:30
    };
  }

  if (checkInMinutes <= 13 * 60 + 59) {
    return {
      shift: "B",
      start: 720,   // 12:00
      end: 1230     // 8:30
    };
  }

  return {
    shift: "C",
    start: 840,      // 2:00
    end: 1350        // 10:30
  };
}
// 2. رفع مع تصحيح تحويل التواريخ والأوقات
window.uploadAttendanceFile = async function () {
  const fileInput = document.getElementById('attendanceFile');
  const file = fileInput.files[0];

  if (!file) {
    return alert("يرجى اختيار ملف Excel أو CSV للرفع.");
  }

  const reader = new FileReader();

  reader.onload = async function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: false });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // جلب البيانات كـ JSON
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { raw: true });

      if (jsonRows.length === 0) {
        return alert("الملف فارغ أو صيغته غير صحيحة.");
      }

      let successCount = 0;

      for (const row of jsonRows) {
        const userId = (row['كود الموظف'] || row['userId'] || row['Code'] || '').toString().trim();
        let rawDate = (row['التاريخ'] || row['date'] || row['Date'] || '').toString().trim();
        let rawCheckIn = row['التاكيد'] || row['الحضور'] || row['checkIn'] || row['CheckIn'] || '';
        let rawCheckOut = row['الانصراف'] || row['checkOut'] || row['CheckOut'] || '';

        if (userId && rawDate) {
          // تحويل التاريخ من صيغة إكسل
          const dateStr = excelSerialToDate(rawDate);
          // تحويل أوقات الحضور والانصراف من صيغة إكسل
          const checkIn = excelSerialToTime(rawCheckIn);
          const checkOut = excelSerialToTime(rawCheckOut);

          const dateParts = dateStr.split('-');
          let year = new Date().getFullYear();
          let month = new Date().getMonth() + 1;

          if (dateParts.length >= 2) {
            year = parseInt(dateParts[0]);
            month = parseInt(dateParts[1]);
          }

          const docId = `${userId}_${dateStr}`;


          let overtimeMinutes = 0;
          let delayMinutes = 0;
          let shiftName = "-";

          const inMinutes =
            timeToMinutes(checkIn);

          const outMinutes =
            timeToMinutes(checkOut);

          if (inMinutes !== null) {

            const shift =
              getShift(inMinutes);

            shiftName = shift.shift;

            delayMinutes =
              Math.max(
                0,
                inMinutes - shift.start
              );

            if (outMinutes !== null) {

              const earlyLeaveMinutes =
                Math.max(
                  0,
                  shift.end - outMinutes
                );

              delayMinutes += earlyLeaveMinutes;

              overtimeMinutes =
                Math.max(
                  0,
                  outMinutes - shift.end
                );
            }
          }

          await setDoc(doc(db, "attendance", docId), {
            userId: userId,
            date: dateStr,
            checkIn: checkIn || '-',
            checkOut: checkOut || '-',
            shift: shiftName,
            year: year,
            delayMinutes: delayMinutes,
            overtimeMinutes: overtimeMinutes,
            month: month,
            timestamp: new Date(`${dateStr}T00:00:00`),
            createdAt: new Date()
          }, { merge: true });

          successCount++;
        }
      }

      alert(`تم تصحيح ورفع ${successCount} سجل بنجاح!`);
      fileInput.value = '';
      await loadAllAttendance();

    } catch (err) {
      console.error("خطأ معالجة الملف:", err);
      alert("حدث خطأ أثناء قراءة الملف. يرجى التأكد من التنسيق الصحيح.");
    }
  };

  reader.readAsArrayBuffer(file);
};

// 3. جلب بيانات الموظفين
async function loadEmployees() {

  try {

    const querySnapshot =
      await getDocs(collection(db, "employees"));

    employeesMap = {};

    const filterSelect =
      document.getElementById('filterEmployee');

    const leaveEmployee =
      document.getElementById('leaveEmployee');

    filterSelect.innerHTML =
      '<option value="ALL">جميع الموظفين</option>';

    if (leaveEmployee)
      leaveEmployee.innerHTML = '';

    querySnapshot.forEach((documentSnap) => {

      const data = documentSnap.data();

      if (data.employeeCode) {

        employeesMap[data.employeeCode] = data;

        const opt =
          document.createElement('option');

        opt.value = data.employeeCode;

        opt.textContent =
          `${data.name} (${data.employeeCode}) - ${data.jobTitle || ''}`;

        filterSelect.appendChild(opt);

        if (leaveEmployee) {

          const leaveOpt =
            document.createElement('option');

          leaveOpt.value =
            data.employeeCode;

          leaveOpt.textContent =
            `${data.name} (${data.employeeCode})`;

          leaveEmployee.appendChild(leaveOpt);

        }

      }

    });

  } catch (e) {

    console.error(
      "خطأ تحميل قائمة الموظفين:",
      e
    );

  }

}

// 4. تحميل جميع سجلات الحضور
async function loadAllAttendance() {

  try {
    const querySnapshot = await getDocs(collection(db, "attendance"));
    allAttendanceLogs = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      allAttendanceLogs.push(data);
    });

    allAttendanceLogs.sort((a, b) => {
      const timeA = a.timestamp && a.timestamp.seconds ? a.timestamp.seconds : 0;
      const timeB = b.timestamp && b.timestamp.seconds ? b.timestamp.seconds : 0;
      return timeB - timeA;
    });

    renderTable();
    updateDashboard();
  } catch (e) {
    console.error("خطأ تحميل الحضور:", e);
  }
}

// 5. عرض جدول الحضور بتنسيق 12 ساعة
function renderTable() {
  const tbody = document.getElementById('attendanceTableBody');
  tbody.innerHTML = '';

  if (allAttendanceLogs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد سجلات حضور.</td></tr>';
    return;
  }

  allAttendanceLogs.forEach(log => {
    const empCode = log.userId || '-';
    const empInfo = employeesMap[empCode] || {};

    const formattedCheckIn = formatTimeTo12Hour(log.checkIn);
    const formattedCheckOut = formatTimeTo12Hour(log.checkOut);

    const tr = document.createElement('tr');
    if (log.status) {

      tr.innerHTML = `
            <td><strong>${empCode}</strong></td>
            <td>${empInfo.name || '-'}</td>
            <td>${empInfo.jobTitle || '-'}</td>
            <td>${log.date || '-'}</td>
            <td colspan="2">
               ${STATUS_MAP[log.status] || log.status}
            </td>
         `;

    }
    else {
      tr.innerHTML = `
        <td><strong>${empCode}</strong></td>
        <td>${empInfo.name || '<span style="color:#888;">غير معروف</span>'}</td>
        <td>${empInfo.jobTitle || '-'}</td>
        <td>${log.date || '-'}</td>
        <td>🟢 ${formattedCheckIn}</td>
        <td>🔴 ${formattedCheckOut !== '-' ? formattedCheckOut : '<span style="color:#dc3545;">لم يسجل</span>'}</td>
      `;
    }

    tbody.appendChild(tr);
  });
}

// 6. إعداد خيارات السنة والشهر
function setupDateSelectors() {

  const yearSelect =
    document.getElementById('filterYear');

  yearSelect.innerHTML = '';

  const years =
    [...new Set(
      allAttendanceLogs
        .map(log => log.year)
        .filter(Boolean)
    )];

  years.sort((a, b) => b - a);

  years.forEach(year => {

    const opt =
      document.createElement('option');

    opt.value = year;
    opt.textContent = year;

    yearSelect.appendChild(opt);

  });

  updateMonthSelector();
}
function updateMonthSelector() {

  const yearSelect =
    document.getElementById('filterYear');

  const monthSelect =
    document.getElementById('filterMonth');

  const selectedYear =
    parseInt(yearSelect.value);

  monthSelect.innerHTML = '';

  const months =
    [...new Set(
      allAttendanceLogs
        .filter(
          log => log.year === selectedYear
        )
        .map(
          log => log.month
        )
    )];

  months.sort((a, b) => a - b);

  months.forEach(month => {

    const opt =
      document.createElement('option');

    opt.value = month;

    opt.textContent =
      monthNames[month - 1];

    monthSelect.appendChild(opt);

  });
}

// 7. تصدير التقرير الشهري
window.exportReport = function () {
  const selectedEmpCode = document.getElementById('filterEmployee').value;
  const selectedYear = parseInt(document.getElementById('filterYear').value);
  const selectedMonth = parseInt(document.getElementById('filterMonth').value);

  let filtered = allAttendanceLogs.filter(log => {
    const matchYear = log.year === selectedYear;
    const matchMonth = log.month === selectedMonth;
    const matchEmp = (selectedEmpCode === "ALL") || (log.userId === selectedEmpCode);
    return matchYear && matchMonth && matchEmp;
  });

  if (filtered.length === 0) {
    return alert("لا توجد سجلات مطابقة للفلتر المحدد.");
  }

  let csvContent = "\uFEFF";
  csvContent += "كود الموظف,اسم الموظف,الوظيفة,البريد الإلكتروني,التاريخ,وقت الحضور,وقت الانصراف\n";

  filtered.forEach(log => {
    const empCode = log.userId || '';
    const empInfo = employeesMap[empCode] || {};
    const empName = empInfo.name || '';
    const empJob = empInfo.jobTitle || '';
    const empEmail = empInfo.userEmail || '';
    const checkInStr = formatTimeTo12Hour(log.checkIn);
    const checkOutStr = log.checkOut ? formatTimeTo12Hour(log.checkOut) : 'لم يسجل انصراف';

    csvContent += `"${empCode}","${empName}","${empJob}","${empEmail}","${log.date}","${checkInStr}","${checkOutStr}"\n`;
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const fileName = `تقرير_الموظفين_${selectedEmpCode}_${selectedMonth}_${selectedYear}.csv`;

  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);

  link.click();
  document.body.removeChild(link);
};
window.saveLeave =
  async function () {

    const employee =
      document.getElementById(
        'leaveEmployee'
      ).value;

    const leaveDate =
      document.getElementById(
        'leaveDate'
      ).value;

    const leaveType =
      document.getElementById(
        'leaveType'
      ).value;

    if (!employee || !leaveDate) {

      alert("أكمل البيانات");

      return;
    }

    const d =
      new Date(leaveDate);

    const docId =
      `${employee}_${leaveDate}`;

    await setDoc(
      doc(
        db,
        "attendance",
        docId
      ),
      {

        userId: employee,

        date: leaveDate,

        status: leaveType,
        timestamp: new Date(leaveDate),

        checkIn: "-",

        checkOut: "-",

        overtimeMinutes: 0,

        delayMinutes: 0,

        year:
          d.getFullYear(),

        month:
          d.getMonth() + 1

      }
    );

    alert(
      "تم حفظ الإجازة بنجاح"
    );

    loadAllAttendance();

  }
function updateDashboard() {

  let totalEmployees =
    Object.keys(employeesMap).length;

  let totalPresent = 0;
  let totalLeaves = 0;
  let totalAbsence = 0;
  let totalOvertime = 0;
  let totalDelay = 0;

  allAttendanceLogs.forEach(log => {

    if (
      log.status === "weekly_off" ||
      log.status === "annual_leave" ||
      log.status === "official_leave" ||
      log.status === "deduction_leave"
    ) {
      totalLeaves++;
    }
    else if (
      log.status === "absence"
    ) {
      totalAbsence++;
    }
    else {
      totalPresent++;
    }

    totalOvertime +=
      Number(log.overtimeMinutes || 0);

    totalDelay +=
      Number(log.delayMinutes || 0);
  });

  document.getElementById("totalEmployees").textContent = totalEmployees;

  document.getElementById(
    "totalPresent"
  ).textContent = totalPresent;

  document.getElementById(
    "totalLeaves"
  ).textContent = totalLeaves;

  document.getElementById(
    "totalAbsence"
  ).textContent = totalAbsence;

  document.getElementById(
    "totalOvertime"
  ).textContent = totalOvertime;

  document.getElementById(
    "totalDelay"
  ).textContent = totalDelay;
}
window.logout = function () {
  signOut(auth);
};