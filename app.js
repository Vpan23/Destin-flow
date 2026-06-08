const STORAGE_ROOT_KEY = "destinFlowData";
const SESSION_KEY = "destinFlowSession";
let STORAGE_KEY = getActiveStorageKey();

const FAMILY_CATEGORIES = [
  "Comida",
  "Transporte",
  "Hogar",
  "Salud",
  "Educacion",
  "Entretenimiento",
  "Deudas",
  "Servicios",
  "Otros"
];

const BUSINESS_CATEGORIES = [
  "Compras",
  "Operativos",
  "Logistica",
  "Planilla",
  "Servicios",
  "Inventario",
  "Transporte",
  "Marketing",
  "Impuestos",
  "Otros"
];

const titles = {
  dashboard: "Dashboard general",
  family: "Familia",
  "family-expense": "Agregar gasto familiar",
  members: "Miembros",
  payments: "Metodos de pago",
  business: "Negocios",
  "business-expense": "Agregar gasto de negocio",
  reports: "Reportes",
  settings: "Configuracion"
};

const FREE_PLAN_LIMITS = {
  familyGroups: 1,
  activeMembers: 4,
  businesses: 1,
  reportLevel: "Basico"
};

let state = loadData();
let editingExpenseId = null;
let editingMemberId = null;
let editingPaymentId = null;
let editingBusinessId = null;

function createId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSeedData() {
  const now = new Date();
  const currentMonth = toMonthKey(now);
  const previousMonth = toMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  return {
    familyGroup: {
      id: "family-1",
      name: "Familia Destin",
      currency: "USD",
      controlMonth: currentMonth,
      monthlyFamilyBudget: 800,
      monthlyBusinessBudget: 1200
    },
    userProfile: null,
    categories: {
      family: FAMILY_CATEGORIES,
      business: BUSINESS_CATEGORIES
    },
    categoryBudgets: {
      family: {},
      business: {}
    },
    members: [
      { id: "member-dad", name: "Papa", role: "papa", color: "#1f7a4d", status: "activo" },
      { id: "member-mom", name: "Mama", role: "mama", color: "#146c72", status: "activo" },
      { id: "member-son", name: "Hijo", role: "hijo", color: "#b3842c", status: "activo" }
    ],
    paymentMethods: [
      {
        id: "pay-cash",
        name: "Efectivo",
        type: "efectivo",
        ownerId: "member-dad",
        monthlyLimit: null,
        shared: true,
        allowedMemberIds: ["member-dad", "member-mom", "member-son"]
      },
      {
        id: "pay-visa",
        name: "Tarjeta Visa Familiar",
        type: "tarjeta",
        ownerId: "member-dad",
        monthlyLimit: 250,
        shared: true,
        allowedMemberIds: ["member-dad", "member-mom"]
      },
      {
        id: "pay-yappy",
        name: "Yappy",
        type: "Yappy",
        ownerId: "member-mom",
        monthlyLimit: 180,
        shared: false,
        allowedMemberIds: ["member-mom"]
      },
      {
        id: "pay-transfer",
        name: "Transferencia Banco",
        type: "transferencia",
        ownerId: "member-dad",
        monthlyLimit: 500,
        shared: true,
        allowedMemberIds: ["member-dad", "member-mom"]
      }
    ],
    businesses: [
      {
        id: "business-hardware",
        name: "Ferreteria Destin",
        type: "Ferreteria",
        currency: "USD",
        description: "Negocio familiar de herramientas y materiales."
      }
    ],
    expenses: [
      createFamilyExpense("45", dateInMonth(currentMonth, 5), "member-mom", "Comida", "pay-visa", "Supermercado", `${dateInMonth(currentMonth, 5)}T08:35:12`),
      createFamilyExpense("15", dateInMonth(currentMonth, 8), "member-dad", "Transporte", "pay-cash", "Taxi", `${dateInMonth(currentMonth, 8)}T12:10:44`),
      createFamilyExpense("80", dateInMonth(currentMonth, 12), "member-dad", "Hogar", "pay-transfer", "Reparacion menor", `${dateInMonth(currentMonth, 12)}T17:22:05`),
      createFamilyExpense("120", dateInMonth(currentMonth, 18), "member-mom", "Servicios", "pay-visa", "Electricidad", `${dateInMonth(currentMonth, 18)}T19:04:31`),
      createFamilyExpense("65", dateInMonth(previousMonth, 11), "member-dad", "Comida", "pay-cash", "Mercado", `${dateInMonth(previousMonth, 11)}T09:18:27`),
      createFamilyExpense("90", dateInMonth(previousMonth, 22), "member-mom", "Hogar", "pay-visa", "Articulos de casa", `${dateInMonth(previousMonth, 22)}T14:42:10`),
      createBusinessExpense("300", dateInMonth(currentMonth, 4), "business-hardware", "Compras", "pay-transfer", "Compra de mercancia", "Proveedor Central", "Papa", `${dateInMonth(currentMonth, 4)}T10:05:49`),
      createBusinessExpense("35", dateInMonth(currentMonth, 10), "business-hardware", "Logistica", "pay-cash", "Envio local", "Mensajeria", "Mama", `${dateInMonth(currentMonth, 10)}T15:30:18`),
      createBusinessExpense("60", dateInMonth(currentMonth, 16), "business-hardware", "Servicios", "pay-visa", "Internet negocio", "Cable Operador", "Papa", `${dateInMonth(currentMonth, 16)}T11:48:36`),
      createBusinessExpense("210", dateInMonth(previousMonth, 14), "business-hardware", "Inventario", "pay-transfer", "Reposicion", "Proveedor Central", "Papa", `${dateInMonth(previousMonth, 14)}T16:12:54`)
    ],
    demoData: true
  };
}

function createStarterData(displayName = "Yo", usageMode = "both", identifier = "") {
  const now = new Date();
  const currentMonth = toMonthKey(now);
  const groupName = usageMode === "business" ? "Mi negocio" : "Mi grupo";
  const groupType = usageMode === "business" ? "negocio" : usageMode === "family" ? "familia" : "mixto";
  const adminMember = createMember(displayName || "Yo", "admin", "#1f7a4d", "activo");
  adminMember.email = cleanText(identifier).toLowerCase();
  const paymentMethod = createDefaultPaymentMethod(adminMember.id);

  const group = {
    id: createId("group"),
    name: groupName,
    type: groupType,
    adminMemberId: adminMember.id,
    adminEmail: adminMember.email,
    createdAt: getCurrentTimestamp(),
    archived: false,
    familyGroup: {
      id: createId("family"),
      name: groupName,
      currency: "USD",
      controlMonth: currentMonth,
      monthlyFamilyBudget: 0,
      monthlyBusinessBudget: 0
    },
    categories: {
      family: FAMILY_CATEGORIES.slice(),
      business: BUSINESS_CATEGORIES.slice()
    },
    categoryBudgets: {
      family: {},
      business: {}
    },
    members: [adminMember],
    paymentMethods: [paymentMethod],
    businesses: [],
    expenses: [],
    invitations: [],
    activity: []
  };

  return {
    familyGroup: group.familyGroup,
    userProfile: null,
    categories: group.categories,
    categoryBudgets: group.categoryBudgets,
    members: group.members,
    paymentMethods: group.paymentMethods,
    businesses: group.businesses,
    expenses: group.expenses,
    groups: [group],
    activeGroupId: group.id,
    demoData: false
  };
}

function getStorageSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch (error) {
    return null;
  }
}

function getUserStorageKey(email) {
  return `${STORAGE_ROOT_KEY}:user:${cleanText(email).toLowerCase()}`;
}

function createLocalIdentifier(name) {
  const slug = cleanText(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `local:${slug || "invitado"}`;
}

function getActiveStorageKey() {
  const session = getStorageSession();
  return session?.email ? getUserStorageKey(session.email) : STORAGE_ROOT_KEY;
}

function setStorageSession(email, authProvider = "local") {
  const cleanEmail = cleanText(email).toLowerCase();
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    email: cleanEmail,
    authProvider,
    lastLoginAt: getCurrentTimestamp()
  }));
  STORAGE_KEY = getUserStorageKey(cleanEmail);
}

function clearStorageSession() {
  localStorage.removeItem(SESSION_KEY);
  STORAGE_KEY = STORAGE_ROOT_KEY;
}

function applyProfileToData(data, email, usageMode = "both", authProvider = "local", displayName = "") {
  data.userProfile = {
    email: cleanText(email).toLowerCase(),
    displayName: cleanText(displayName) || data.userProfile?.displayName || cleanText(email),
    usageMode,
    createdAt: data.userProfile?.createdAt || getCurrentTimestamp(),
    authProvider,
    startedClean: authProvider === "local" && data.demoData === false
  };
  return data;
}

function loadDataForUser(email, usageMode = "both", authProvider = "local", displayName = "") {
  setStorageSession(email, authProvider);
  const saved = localStorage.getItem(STORAGE_KEY);
  let data;

  if (saved) {
    try {
      data = normalizeData(JSON.parse(saved));
      if (authProvider === "local" && looksLikeUntouchedDemoData(data)) {
        data = normalizeData(createStarterData(displayName, usageMode, email));
      }
      data.userProfile = data.userProfile || {};
      data.userProfile.email = cleanText(email).toLowerCase();
      data.userProfile.displayName = data.userProfile.displayName || cleanText(displayName) || cleanText(email);
      data.userProfile.usageMode = data.userProfile.usageMode || usageMode;
      data.userProfile.authProvider = data.userProfile.authProvider || authProvider;
      data.userProfile.startedClean = data.userProfile.startedClean || (authProvider === "local" && data.demoData === false);
    } catch (error) {
      data = applyProfileToData(normalizeData(createStarterData(displayName, usageMode, email)), email, usageMode, authProvider, displayName);
    }
  } else {
    data = applyProfileToData(normalizeData(createStarterData(displayName, usageMode, email)), email, usageMode, authProvider, displayName);
  }

  saveData(data, { markDirty: false });
  return data;
}

// El almacenamiento local se separa por correo para que cada usuario vea sus propios datos.
function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const session = getStorageSession();
    if (session?.email) {
      const starter = applyProfileToData(
        normalizeData(createStarterData(session.email.split("@")[0] || "Yo", "both", session.email)),
        session.email,
        "both",
        session.authProvider || "google",
        session.email.split("@")[0] || "Yo"
      );
      saveData(starter, { markDirty: false });
      return starter;
    }
    const seed = normalizeData(createSeedData());
    saveData(seed, { markDirty: false });
    return seed;
  }

  try {
    let data = normalizeData(JSON.parse(saved));
    if (data.userProfile?.email && looksLikeUntouchedDemoData(data)) {
      data = applyProfileToData(
        normalizeData(createStarterData(data.userProfile.displayName || "Yo", data.userProfile.usageMode || "both", data.userProfile.email)),
        data.userProfile.email,
        data.userProfile.usageMode || "both",
        data.userProfile.authProvider || "local",
        data.userProfile.displayName || "Yo"
      );
      saveData(data, { markDirty: false });
    }
    if (STORAGE_KEY === STORAGE_ROOT_KEY && data.userProfile?.email) {
      setStorageSession(data.userProfile.email, data.userProfile.authProvider || "local");
      if (!localStorage.getItem(STORAGE_KEY)) {
        saveData(data, { markDirty: false });
      }
    }
    return data;
  } catch (error) {
    const seed = normalizeData(createSeedData());
    saveData(seed, { markDirty: false });
    return seed;
  }
}

function saveData(data = state, options = {}) {
  data.lastSavedAt = getCurrentTimestamp();
  data.sync = data.sync || {};
  const shouldMarkDirty = options.markDirty !== false && data.userProfile;
  if (shouldMarkDirty) {
    data.sync.hasPendingChanges = true;
    data.sync.lastLocalChangeAt = data.lastSavedAt;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (shouldMarkDirty) {
    window.dispatchEvent(new CustomEvent("destin-flow:local-save", {
      detail: {
        storageKey: STORAGE_KEY,
        activeGroupId: data.activeGroupId,
        savedAt: data.lastSavedAt
      }
    }));
  }
}

function looksLikeUntouchedDemoData(data) {
  const demoExpenseDescriptions = [
    "Supermercado",
    "Taxi",
    "Reparacion menor",
    "Electricidad",
    "Mercado",
    "Articulos de casa",
    "Compra de mercancia",
    "Envio local",
    "Internet negocio",
    "Reposicion"
  ];
  const expenses = Array.isArray(data.expenses) ? data.expenses : [];
  const hasDemoMembers = data.members?.some((member) => member.id === "member-dad")
    && data.members?.some((member) => member.id === "member-mom");
  const hasDemoBusiness = data.businesses?.some((business) => business.id === "business-hardware");
  const hasOnlyDemoExpenses = expenses.length === demoExpenseDescriptions.length
    && demoExpenseDescriptions.every((description) => expenses.some((expense) => expense.description === description));

  return Boolean(!data.userProfile?.startedClean && hasDemoMembers && hasDemoBusiness && hasOnlyDemoExpenses);
}

function markCloudSynced(cloudTime = getCurrentTimestamp()) {
  state.sync = state.sync || {};
  state.sync.hasPendingChanges = false;
  state.sync.lastCloudPushAt = cloudTime;
  saveData(state, { markDirty: false });
  renderSyncStatus();
}

function createFamilyExpense(amount, date, memberId, category, paymentMethodId, description, registeredAt = getCurrentTimestamp(), paymentStatus = "pagado") {
  const timestamp = getCurrentTimestamp();
  return {
    id: createId("expense"),
    type: "familiar",
    amount: Number(amount),
    date,
    registeredAt,
    updatedAt: timestamp,
    memberId,
    category,
    paymentMethodId,
    paymentStatus: normalizePaymentStatus(paymentStatus),
    description: description || ""
  };
}

function createBusinessExpense(amount, date, businessId, category, paymentMethodId, description, vendor, responsible, registeredAt = getCurrentTimestamp(), paymentStatus = "pagado") {
  const timestamp = getCurrentTimestamp();
  return {
    id: createId("expense"),
    type: "negocio",
    amount: Number(amount),
    date,
    registeredAt,
    updatedAt: timestamp,
    businessId,
    category,
    paymentMethodId,
    paymentStatus: normalizePaymentStatus(paymentStatus),
    description: description || "",
    vendor: vendor || "",
    responsible: responsible || ""
  };
}

function createMember(name, role, color, status) {
  return {
    id: createId("member"),
    name: cleanText(name),
    role: role || "otro",
    color: color || "#1f7a4d",
    status: status || "activo"
  };
}

function getCurrentUserEmail() {
  return state.userProfile?.email || "";
}

function getCurrentUserMember() {
  const email = getCurrentUserEmail();
  return state.members.find((member) => member.email && member.email === email)
    || findById(state.members, getActiveGroup().adminMemberId)
    || state.members[0];
}

function getCurrentUserRole() {
  const member = getCurrentUserMember();
  if (!member) return "admin";
  if (member.id === getActiveGroup().adminMemberId) return "admin";
  return member.role || "miembro";
}

function canManageGroup() {
  return getCurrentUserRole() === "admin";
}

function canMutateData() {
  return getCurrentUserRole() !== "solo_lectura";
}

function requireGroupManager() {
  if (canManageGroup()) return true;
  showToast("Solo el admin puede hacer esta accion.");
  return false;
}

function requireEditor() {
  if (canMutateData()) return true;
  showToast("Tu rol es solo lectura.");
  return false;
}

function createPaymentMethod(name, type, ownerId, monthlyLimit, shared, allowedMemberIds) {
  const allowedIds = [...new Set([ownerId].concat(allowedMemberIds))].filter(Boolean);

  return {
    id: createId("pay"),
    name: cleanText(name),
    type: type || "otro",
    ownerId,
    monthlyLimit: monthlyLimit ? Number(monthlyLimit) : null,
    shared: shared === "true",
    allowedMemberIds: allowedIds
  };
}

function createDefaultPaymentMethod(ownerId) {
  return {
    id: createId("pay"),
    name: "Efectivo",
    type: "efectivo",
    ownerId,
    monthlyLimit: null,
    shared: true,
    allowedMemberIds: ownerId ? [ownerId] : []
  };
}

function createBusiness(name, type, currency, description) {
  return {
    id: createId("business"),
    name: cleanText(name),
    type: cleanText(type),
    currency: cleanText(currency || "USD").toUpperCase(),
    description: cleanText(description)
  };
}

function createGroup(name, type, adminName, adminEmail) {
  const now = new Date();
  const currentMonth = toMonthKey(now);
  const adminMember = createMember(adminName, "admin", "#1f7a4d", "activo");

  return {
    id: createId("group"),
    name: cleanText(name),
    type: type || "otro",
    adminMemberId: adminMember.id,
    adminEmail: cleanText(adminEmail).toLowerCase(),
    createdAt: getCurrentTimestamp(),
    archived: false,
    familyGroup: {
      id: createId("family"),
      name: cleanText(name),
      currency: state?.familyGroup?.currency || "USD",
      controlMonth: currentMonth,
      monthlyFamilyBudget: 0,
      monthlyBusinessBudget: 0
    },
    categories: {
      family: FAMILY_CATEGORIES.slice(),
      business: BUSINESS_CATEGORIES.slice()
    },
    categoryBudgets: {
      family: {},
      business: {}
    },
    members: [adminMember],
    paymentMethods: [createDefaultPaymentMethod(adminMember.id)],
    businesses: [],
    expenses: [],
    invitations: [],
    activity: []
  };
}

function createGroupFromLegacyData(data) {
  const adminMember = data.members?.[0];
  return {
    id: "group-default",
    name: data.familyGroup?.name || "Grupo principal",
    type: "familia",
    adminMemberId: adminMember?.id || "",
    adminEmail: data.userProfile?.email || "",
    createdAt: getCurrentTimestamp(),
    archived: false,
    familyGroup: data.familyGroup,
    categories: data.categories,
    categoryBudgets: data.categoryBudgets || { family: {}, business: {} },
    members: data.members || [],
    paymentMethods: data.paymentMethods || [],
    businesses: data.businesses || [],
    expenses: data.expenses || [],
    invitations: data.invitations || [],
    activity: data.activity || []
  };
}

function cleanText(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizePaymentStatus(status) {
  return status === "pendiente" ? "pendiente" : "pagado";
}

function paymentStatusLabel(status) {
  return normalizePaymentStatus(status) === "pendiente" ? "Pendiente" : "Pagado";
}

function paymentStatusBadge(status) {
  const safeStatus = normalizePaymentStatus(status);
  return `<span class="status-badge ${safeStatus}">${paymentStatusLabel(safeStatus)}</span>`;
}

function mergeUnique(primary, fallback) {
  return [...new Set(primary.concat(fallback).map(cleanText).filter(Boolean))];
}

function getFamilyCategories() {
  return state.categories?.family || FAMILY_CATEGORIES;
}

function getBusinessCategories() {
  return state.categories?.business || BUSINESS_CATEGORIES;
}

function normalizeCategoryBudgets(budgets = {}, categories = {}) {
  const normalized = {
    family: {},
    business: {}
  };
  ["family", "business"].forEach((type) => {
    const allowed = new Set(categories[type] || []);
    Object.entries(budgets[type] || {}).forEach(([category, value]) => {
      const amount = Number(value || 0);
      if (allowed.has(category) && amount > 0) normalized[type][category] = amount;
    });
  });
  return normalized;
}

function getCategoryBudget(type, category) {
  return Number(state.categoryBudgets?.[type]?.[category] || 0);
}

function setCategoryBudget(type, category, amount) {
  state.categoryBudgets = state.categoryBudgets || { family: {}, business: {} };
  state.categoryBudgets[type] = state.categoryBudgets[type] || {};
  const value = Number(amount || 0);
  if (value > 0) state.categoryBudgets[type][category] = value;
  else delete state.categoryBudgets[type][category];
}

// Cada gasto guarda la fecha/hora exacta de captura en el navegador del usuario.
function getCurrentTimestamp() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 19);
}

function normalizeData(data) {
  data.userProfile = data.userProfile || null;
  if (data.userProfile && !data.userProfile.displayName) {
    data.userProfile.displayName = data.userProfile.email || "Perfil local";
  }
  data.lastSavedAt = data.lastSavedAt || getCurrentTimestamp();
  data.sync = data.sync || {};
  data.sync.hasPendingChanges = Boolean(data.sync.hasPendingChanges);
  data.sync.lastLocalChangeAt = data.sync.lastLocalChangeAt || "";
  data.sync.lastCloudPushAt = data.sync.lastCloudPushAt || "";
  data.categories = data.categories || {};
  data.categories.family = mergeUnique(data.categories.family || FAMILY_CATEGORIES, FAMILY_CATEGORIES);
  data.categories.business = mergeUnique(data.categories.business || BUSINESS_CATEGORIES, BUSINESS_CATEGORIES);
  data.categoryBudgets = normalizeCategoryBudgets(data.categoryBudgets, data.categories);
  data.familyGroup.monthlyFamilyBudget = Number(data.familyGroup.monthlyFamilyBudget || 0);
  data.familyGroup.monthlyBusinessBudget = Number(data.familyGroup.monthlyBusinessBudget || 0);
  data.expenses = data.expenses.map((expense) => ({
    ...expense,
    paymentStatus: normalizePaymentStatus(expense.paymentStatus),
    registeredAt: expense.registeredAt || `${expense.date}T12:00:00`,
    updatedAt: expense.updatedAt || expense.registeredAt || `${expense.date}T12:00:00`
  }));
  if (!Array.isArray(data.groups) || !data.groups.length) {
    data.groups = [createGroupFromLegacyData(data)];
    data.activeGroupId = data.groups[0].id;
  }
  data.groups.forEach((group) => {
    group.archived = Boolean(group.archived);
    group.categories = group.categories || {};
    group.categories.family = mergeUnique(group.categories.family || FAMILY_CATEGORIES, FAMILY_CATEGORIES);
    group.categories.business = mergeUnique(group.categories.business || BUSINESS_CATEGORIES, BUSINESS_CATEGORIES);
    group.categoryBudgets = normalizeCategoryBudgets(group.categoryBudgets, group.categories);
    group.familyGroup.monthlyFamilyBudget = Number(group.familyGroup.monthlyFamilyBudget || 0);
    group.familyGroup.monthlyBusinessBudget = Number(group.familyGroup.monthlyBusinessBudget || 0);
    group.paymentMethods = group.paymentMethods || [];
    if (!group.paymentMethods.length) {
      group.paymentMethods.push(createDefaultPaymentMethod(group.adminMemberId || group.members?.[0]?.id));
    }
    group.invitations = group.invitations || [];
    group.activity = group.activity || [];
    group.expenses = (group.expenses || []).map((expense) => ({
      ...expense,
      paymentStatus: normalizePaymentStatus(expense.paymentStatus),
      registeredAt: expense.registeredAt || `${expense.date}T12:00:00`,
      updatedAt: expense.updatedAt || expense.registeredAt || `${expense.date}T12:00:00`
    }));
  });
  const activeGroup = findById(data.groups, data.activeGroupId);
  if (!activeGroup || activeGroup.archived) {
    const firstAvailable = data.groups.find((group) => !group.archived) || data.groups[0];
    firstAvailable.archived = false;
    data.activeGroupId = firstAvailable.id;
  }
  applyActiveGroup(data);

  return data;
}

function getActiveGroup(data = state) {
  return findById(data.groups, data.activeGroupId) || data.groups[0];
}

function applyActiveGroup(data = state) {
  const group = getActiveGroup(data);
  data.familyGroup = group.familyGroup;
  data.categories = group.categories;
  data.categoryBudgets = group.categoryBudgets;
  data.members = group.members;
  data.paymentMethods = group.paymentMethods;
  data.businesses = group.businesses;
  data.expenses = group.expenses;
  data.invitations = group.invitations;
  data.activity = group.activity;
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateInMonth(monthKey, day) {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: state.familyGroup.currency
  }).format(value || 0);
}

function formatTime(timestamp) {
  if (!timestamp) return "--:--:--";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp.slice(11, 19) || "--:--:--";

  return new Intl.DateTimeFormat("es-PA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(date);
}

function getCurrentMonth() {
  return state.familyGroup.controlMonth;
}

function getPreviousMonth() {
  const [year, month] = getCurrentMonth().split("-").map(Number);
  return toMonthKey(new Date(year, month - 2, 1));
}

function isInMonth(expense, monthKey) {
  return expense.date.startsWith(monthKey);
}

function findById(collection, id) {
  return collection.find((item) => item.id === id);
}

function sumExpenses(expenses) {
  return expenses.reduce((total, expense) => total + Number(expense.amount), 0);
}

function groupTotal(expenses, keyGetter) {
  return expenses.reduce((totals, expense) => {
    const key = keyGetter(expense);
    totals[key] = (totals[key] || 0) + Number(expense.amount);
    return totals;
  }, {});
}

function topEntry(totals) {
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0] || null;
}

// Las metricas derivadas evitan duplicar datos guardados y mantienen los reportes consistentes.
function getMetrics() {
  const currentMonth = getCurrentMonth();
  const previousMonth = getPreviousMonth();
  const familyCurrent = state.expenses.filter((expense) => expense.type === "familiar" && isInMonth(expense, currentMonth));
  const familyPrevious = state.expenses.filter((expense) => expense.type === "familiar" && isInMonth(expense, previousMonth));
  const businessCurrent = state.expenses.filter((expense) => expense.type === "negocio" && isInMonth(expense, currentMonth));
  const businessPrevious = state.expenses.filter((expense) => expense.type === "negocio" && isInMonth(expense, previousMonth));
  const familyTotal = sumExpenses(familyCurrent);
  const familyPreviousTotal = sumExpenses(familyPrevious);
  const businessTotal = sumExpenses(businessCurrent);
  const businessPreviousTotal = sumExpenses(businessPrevious);
  const pendingCurrent = familyCurrent.concat(businessCurrent).filter((expense) => normalizePaymentStatus(expense.paymentStatus) === "pendiente");
  const pendingTotal = sumExpenses(pendingCurrent);
  const difference = familyTotal - familyPreviousTotal;
  const percentage = familyPreviousTotal ? (difference / familyPreviousTotal) * 100 : 0;

  return {
    currentMonth,
    previousMonth,
    familyCurrent,
    familyPrevious,
    businessCurrent,
    businessPrevious,
    familyTotal,
    familyPreviousTotal,
    businessTotal,
    businessPreviousTotal,
    pendingCurrent,
    pendingTotal,
    difference,
    percentage
  };
}

function generateInsights(metrics) {
  const memberTop = topEntry(groupTotal(metrics.familyCurrent, (expense) => expense.memberId));
  const categoryTop = topEntry(groupTotal(metrics.familyCurrent, (expense) => expense.category));
  const paymentTop = topEntry(groupTotal(metrics.familyCurrent.concat(metrics.businessCurrent), (expense) => expense.paymentMethodId));
  const businessTop = topEntry(groupTotal(metrics.businessCurrent, (expense) => expense.businessId));

  const insights = [];
  const alerts = [];

  if (metrics.difference > 0) {
    alerts.push(`Estas gastando ${formatMoney(metrics.difference)} mas que el mes pasado en familia.`);
  } else if (metrics.difference < 0) {
    insights.push(`El gasto familiar bajo ${formatMoney(Math.abs(metrics.difference))} contra el mes anterior.`);
  }

  if (memberTop) {
    const member = findById(state.members, memberTop[0]);
    insights.push(`El miembro que mas gasto fue ${member.name} con ${formatMoney(memberTop[1])}.`);
    alerts.push(`El miembro que mas gasto fue ${member.name}.`);
  }

  if (categoryTop) {
    insights.push(`La categoria familiar mas costosa fue ${categoryTop[0]}.`);
    alerts.push(`La categoria mas costosa este mes es ${categoryTop[0]}.`);
  }

  if (paymentTop) {
    const method = findById(state.paymentMethods, paymentTop[0]);
    insights.push(`El metodo de pago con mas gasto fue ${method.name} con ${formatMoney(paymentTop[1])}.`);
  }

  if (businessTop) {
    const business = findById(state.businesses, businessTop[0]);
    insights.push(`El negocio ${business.name} representa el mayor gasto empresarial.`);
    alerts.push(`El negocio con mas gasto este mes fue ${business.name}.`);
  }

  state.paymentMethods.forEach((method) => {
    if (!method.monthlyLimit) return;
    const total = sumExpenses(state.expenses.filter((expense) => expense.paymentMethodId === method.id && isInMonth(expense, metrics.currentMonth)));
    if (total > method.monthlyLimit) {
      alerts.push(`${method.name} ya supera su limite mensual.`);
    }
  });

  addBudgetAlerts(alerts, insights, metrics);

  return { insights, alerts };
}

function addBudgetAlerts(alerts, insights, metrics) {
  const familyBudget = state.familyGroup.monthlyFamilyBudget;
  const businessBudget = state.familyGroup.monthlyBusinessBudget;

  if (familyBudget) {
    const percent = (metrics.familyTotal / familyBudget) * 100;
    insights.push(`Familia lleva ${percent.toFixed(1)}% del presupuesto mensual.`);
    if (percent >= 100) alerts.push("El gasto familiar ya supero el presupuesto mensual.");
    else if (percent >= 80) alerts.push("El gasto familiar ya esta por encima del 80% del presupuesto.");
  }

  if (businessBudget) {
    const percent = (metrics.businessTotal / businessBudget) * 100;
    insights.push(`Negocio lleva ${percent.toFixed(1)}% del presupuesto mensual.`);
    if (percent >= 100) alerts.push("El gasto de negocio ya supero el presupuesto mensual.");
    else if (percent >= 80) alerts.push("El gasto de negocio ya esta por encima del 80% del presupuesto.");
  }

  addCategoryBudgetAlerts("family", metrics.familyCurrent, alerts, insights);
  addCategoryBudgetAlerts("business", metrics.businessCurrent, alerts, insights);
}

function addCategoryBudgetAlerts(type, expenses, alerts, insights) {
  const label = type === "family" ? "familiar" : "de negocio";
  const totals = groupTotal(expenses, (expense) => expense.category);
  Object.entries(state.categoryBudgets?.[type] || {}).forEach(([category, budget]) => {
    const total = Number(totals[category] || 0);
    if (!budget || !total) return;
    const percent = (total / budget) * 100;
    insights.push(`${category} lleva ${percent.toFixed(1)}% de su presupuesto ${label}.`);
    if (percent >= 100) alerts.push(`${category} ya supero su presupuesto ${label}.`);
    else if (percent >= 80) alerts.push(`${category} esta por encima del 80% de su presupuesto ${label}.`);
  });
}

function render() {
  applyActiveGroup();
  const metrics = getMetrics();
  const intelligence = generateInsights(metrics);

  applyProfileMode();
  applyPermissions();
  renderGroupSelector();
  renderRoleStatus();
  document.getElementById("current-month-label").textContent = `Mes de control: ${metrics.currentMonth}`;
  renderSaveStatus();
  renderSyncStatus();
  renderDashboard(metrics, intelligence);
  renderFamily(metrics);
  renderMembers();
  renderPayments(metrics);
  renderBusiness(metrics);
  renderReports(metrics);
  renderSettings(metrics);
  renderCategorySettings();
  renderGroups();
  renderInvitations();
  renderAdminTransfer();
  renderActivity();
  populateForms();
}

function renderSaveStatus() {
  document.getElementById("save-status").textContent = `Guardado: ${formatTime(state.lastSavedAt)}`;
}

function renderSyncStatus() {
  const element = document.getElementById("sync-status");
  if (!element) return;

  const sync = state.sync || {};
  element.classList.toggle("pending-sync", Boolean(sync.hasPendingChanges));
  element.classList.toggle("synced-sync", !sync.hasPendingChanges && Boolean(sync.lastCloudPushAt));

  if (sync.hasPendingChanges) {
    element.textContent = "Pendiente de nube";
    element.title = sync.lastLocalChangeAt
      ? `Ultimo cambio local: ${formatTime(sync.lastLocalChangeAt)}`
      : "Hay cambios locales sin subir.";
    return;
  }

  if (sync.lastCloudPushAt) {
    element.textContent = `Nube: ${formatTime(sync.lastCloudPushAt)}`;
    element.title = "Ultima sincronizacion con Supabase.";
    return;
  }

  element.textContent = "Solo local";
  element.title = "Estos datos viven en este navegador.";
}

function renderRoleStatus() {
  const role = getCurrentUserRole();
  const label = role === "solo_lectura" ? "solo lectura" : role;
  document.getElementById("role-status").textContent = `Rol: ${label}`;
}

function applyPermissions() {
  const mayManage = canManageGroup();
  const mayMutate = canMutateData();
  document.querySelectorAll("#group-form, #invite-form, #transfer-admin-form").forEach((element) => {
    element.hidden = !mayManage;
  });
  document.querySelectorAll("form").forEach((form) => {
    if (form.id === "onboarding-form") return;
    if (!mayMutate) {
      form.querySelectorAll("input, select, button").forEach((input) => {
        input.disabled = true;
      });
    } else {
      form.querySelectorAll("input, select, button").forEach((input) => {
        input.disabled = false;
      });
    }
  });
}

function renderDashboard(metrics, intelligence) {
  const dashboardMetrics = [
    ["Gasto familiar", formatMoney(metrics.familyTotal), "Mes actual"],
    ["Presupuesto familiar", formatMoney(state.familyGroup.monthlyFamilyBudget), budgetNote(metrics.familyTotal, state.familyGroup.monthlyFamilyBudget)],
    ["Pendiente por pagar", formatMoney(metrics.pendingTotal), `${metrics.pendingCurrent.length} gasto(s)`],
    ["Mes anterior", formatMoney(metrics.familyPreviousTotal), "Familia"],
    ["Diferencia familiar", formatMoney(metrics.difference), `${metrics.percentage.toFixed(1)}%`],
    ["Gasto negocio", formatMoney(metrics.businessTotal), "Mes actual"],
    ["Presupuesto negocio", formatMoney(state.familyGroup.monthlyBusinessBudget), budgetNote(metrics.businessTotal, state.familyGroup.monthlyBusinessBudget)]
  ];

  document.getElementById("dashboard-metrics").innerHTML = dashboardMetrics.map(([label, value, note]) => `
    <article class="metric-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small class="${metrics.difference > 0 ? "trend-up" : "trend-down"}">${note}</small>
    </article>
  `).join("");

  renderTextList("alerts-list", intelligence.alerts);
  renderTextList("insights-list", intelligence.insights);
}

function renderFamily(metrics) {
  const actions = canMutateData();
  document.getElementById("family-summary-label").textContent = `${state.familyGroup.name} - ${state.familyGroup.currency}`;
  const memberTop = topEntry(groupTotal(metrics.familyCurrent, (expense) => expense.memberId));
  const categoryTop = topEntry(groupTotal(metrics.familyCurrent, (expense) => expense.category));
  const paymentTop = topEntry(groupTotal(metrics.familyCurrent, (expense) => expense.paymentMethodId));

  document.getElementById("family-metrics").innerHTML = [
    ["Total del mes", formatMoney(metrics.familyTotal), "Gastos familiares"],
    ["Pendiente familiar", formatMoney(sumExpenses(metrics.familyCurrent.filter((expense) => normalizePaymentStatus(expense.paymentStatus) === "pendiente"))), "Cuentas por pagar"],
    ["Presupuesto", formatMoney(state.familyGroup.monthlyFamilyBudget), budgetNote(metrics.familyTotal, state.familyGroup.monthlyFamilyBudget)],
    ["Persona que mas gasto", memberTop ? findById(state.members, memberTop[0])?.name || "Sin datos" : "Sin datos", memberTop ? formatMoney(memberTop[1]) : ""],
    ["Categoria mas costosa", categoryTop ? categoryTop[0] : "Sin datos", categoryTop ? formatMoney(categoryTop[1]) : ""],
    ["Metodo con mas gasto", paymentTop ? findById(state.paymentMethods, paymentTop[0])?.name || "Sin datos" : "Sin datos", paymentTop ? formatMoney(paymentTop[1]) : ""]
  ].map(([label, value, note]) => metricCard(label, value, note)).join("");

  const recentExpenses = filterFamilyExpenses(sortExpensesByTime(metrics.familyCurrent));
  document.getElementById("family-expenses-count").textContent = `${recentExpenses.length} de ${metrics.familyCurrent.length} gastos familiares`;
  document.getElementById("family-expenses-table").innerHTML = recentExpenses.length ? recentExpenses.map((expense) => `
    <tr>
      <td data-label="Fecha">${expense.date}</td>
      <td data-label="Hora">${formatTime(expense.registeredAt)}</td>
      <td data-label="Miembro">${escapeHtml(findById(state.members, expense.memberId)?.name || "Sin miembro")}</td>
      <td data-label="Categoria">${escapeHtml(expense.category)}</td>
      <td data-label="Metodo">${escapeHtml(findById(state.paymentMethods, expense.paymentMethodId)?.name || "Sin metodo")}</td>
      <td data-label="Monto">${formatMoney(expense.amount)}</td>
      <td data-label="Estado">${paymentStatusBadge(expense.paymentStatus)}</td>
      <td data-label="Acciones">
        ${actions ? `<button class="secondary-mini" data-edit-expense="${expense.id}">Editar</button>
        <button class="inline-danger" data-delete-expense="${expense.id}">Eliminar</button>` : "Solo lectura"}
      </td>
    </tr>
  `).join("") : tableEmptyState("No hay gastos familiares que coincidan.", 8);
}

function renderMembers() {
  const actions = canMutateData();
  const mayManage = canManageGroup();
  document.getElementById("members-list").innerHTML = state.members.length ? state.members.map((member) => `
    <article class="data-card">
      <header>
        <div class="avatar-dot" style="background:${escapeHtml(member.color)}"></div>
        <span class="tag">${escapeHtml(member.status)}</span>
      </header>
      <h2>${escapeHtml(member.name)}</h2>
      <p class="muted">Rol: ${escapeHtml(member.role)}</p>
      ${actions ? `<button class="secondary-mini" data-edit-member="${member.id}">Editar</button>` : ""}
      ${mayManage ? `<button class="inline-danger" data-remove-member="${member.id}">Expulsar</button>` : ""}
    </article>
  `).join("") : emptyMessage("Agrega el primer miembro de la familia.");
}

function renderPayments(metrics) {
  const actions = canMutateData();
  document.getElementById("payments-list").innerHTML = state.paymentMethods.length ? state.paymentMethods.map((method) => {
    const total = sumExpenses(state.expenses.filter((expense) => expense.paymentMethodId === method.id && isInMonth(expense, metrics.currentMonth)));
    const owner = findById(state.members, method.ownerId);
    const users = method.allowedMemberIds.map((id) => findById(state.members, id)?.name).filter(Boolean).join(", ");
    const overLimit = method.monthlyLimit && total > method.monthlyLimit;

    return `
      <article class="data-card">
        <header>
          <h2>${escapeHtml(method.name)}</h2>
          <span class="tag">${escapeHtml(method.type)}</span>
        </header>
        <p><strong>${formatMoney(total)}</strong> usado este mes</p>
        <p class="muted">Dueno: ${escapeHtml(owner ? owner.name : "Sin dueno")}</p>
        <p class="muted">Usuarios: ${escapeHtml(users)}</p>
        <p class="${overLimit ? "trend-up" : "trend-down"}">${method.monthlyLimit ? `Limite: ${formatMoney(method.monthlyLimit)}` : "Sin limite mensual"}</p>
        ${actions ? `<button class="secondary-mini" data-edit-payment="${method.id}">Editar</button>` : ""}
      </article>
    `;
  }).join("") : emptyMessage("Agrega el primer metodo de pago.");
}

function renderBusiness(metrics) {
  const actions = canMutateData();
  const businessCategoryTop = topEntry(groupTotal(metrics.businessCurrent, (expense) => expense.category));
  const businessPaymentTop = topEntry(groupTotal(metrics.businessCurrent, (expense) => expense.paymentMethodId));
  const highestBusinessExpense = getHighestExpense(metrics.businessCurrent);
  const businessDifference = metrics.businessTotal - metrics.businessPreviousTotal;
  const businessPercentage = metrics.businessPreviousTotal ? (businessDifference / metrics.businessPreviousTotal) * 100 : 0;

  document.getElementById("business-metrics").innerHTML = [
    ["Total negocio", formatMoney(metrics.businessTotal), "Mes actual"],
    ["Pendiente negocio", formatMoney(sumExpenses(metrics.businessCurrent.filter((expense) => normalizePaymentStatus(expense.paymentStatus) === "pendiente"))), "Cuentas por pagar"],
    ["Presupuesto", formatMoney(state.familyGroup.monthlyBusinessBudget), budgetNote(metrics.businessTotal, state.familyGroup.monthlyBusinessBudget)],
    ["Mes anterior", formatMoney(metrics.businessPreviousTotal), `${businessPercentage.toFixed(1)}%`],
    ["Categoria top", businessCategoryTop ? businessCategoryTop[0] : "Sin datos", businessCategoryTop ? formatMoney(businessCategoryTop[1]) : ""],
    ["Gasto mas alto", highestBusinessExpense ? formatMoney(highestBusinessExpense.amount) : "Sin datos", highestBusinessExpense ? highestBusinessExpense.description || highestBusinessExpense.category : ""],
    ["Metodo top", businessPaymentTop ? findById(state.paymentMethods, businessPaymentTop[0])?.name || "Sin datos" : "Sin datos", businessPaymentTop ? formatMoney(businessPaymentTop[1]) : ""]
  ].map(([label, value, note]) => metricCard(label, value, note)).join("");

  document.getElementById("business-list").innerHTML = state.businesses.length ? state.businesses.map((business) => {
    const total = sumExpenses(metrics.businessCurrent.filter((expense) => expense.businessId === business.id));
    return `
      <article class="data-card">
        <header>
          <h2>${escapeHtml(business.name)}</h2>
          <span class="tag">${escapeHtml(business.currency)}</span>
        </header>
        <p><strong>${formatMoney(total)}</strong> gastado este mes</p>
        <p class="muted">${escapeHtml(business.type)}</p>
        <p class="muted">${escapeHtml(business.description)}</p>
        ${actions ? `<button class="secondary-mini" data-edit-business="${business.id}">Editar</button>` : ""}
      </article>
    `;
  }).join("") : emptyMessage("Agrega el primer negocio.");

  const recentExpenses = filterBusinessExpenses(sortExpensesByTime(metrics.businessCurrent));
  document.getElementById("business-expenses-count").textContent = `${recentExpenses.length} de ${metrics.businessCurrent.length} gastos de negocio`;
  document.getElementById("business-expenses-table").innerHTML = recentExpenses.length ? recentExpenses.map((expense) => `
    <tr>
      <td data-label="Fecha">${expense.date}</td>
      <td data-label="Hora">${formatTime(expense.registeredAt)}</td>
      <td data-label="Negocio">${escapeHtml(findById(state.businesses, expense.businessId)?.name || "Sin negocio")}</td>
      <td data-label="Categoria">${escapeHtml(expense.category)}</td>
      <td data-label="Metodo">${escapeHtml(findById(state.paymentMethods, expense.paymentMethodId)?.name || "Sin metodo")}</td>
      <td data-label="Monto">${formatMoney(expense.amount)}</td>
      <td data-label="Estado">${paymentStatusBadge(expense.paymentStatus)}</td>
      <td data-label="Acciones">
        ${actions ? `<button class="secondary-mini" data-edit-expense="${expense.id}">Editar</button>
        <button class="inline-danger" data-delete-expense="${expense.id}">Eliminar</button>` : "Solo lectura"}
      </td>
    </tr>
  `).join("") : tableEmptyState("No hay gastos de negocio que coincidan.", 8);
}

function renderReports(metrics) {
  const familyTotal = metrics.familyTotal || 1;
  const combinedCurrent = metrics.familyCurrent.concat(metrics.businessCurrent);
  const combinedTotal = sumExpenses(combinedCurrent) || 1;
  const familyDifference = metrics.familyTotal - metrics.familyPreviousTotal;
  const businessDifference = metrics.businessTotal - metrics.businessPreviousTotal;

  document.getElementById("report-metrics").innerHTML = [
    ["Pendiente por pagar", formatMoney(metrics.pendingTotal), `${metrics.pendingCurrent.length} gasto(s)`],
    ["Familia actual", formatMoney(metrics.familyTotal), monthTrendText(familyDifference)],
    ["Presupuesto familiar", formatMoney(state.familyGroup.monthlyFamilyBudget), budgetNote(metrics.familyTotal, state.familyGroup.monthlyFamilyBudget)],
    ["Familia anterior", formatMoney(metrics.familyPreviousTotal), metrics.previousMonth],
    ["Negocio actual", formatMoney(metrics.businessTotal), monthTrendText(businessDifference)],
    ["Presupuesto negocio", formatMoney(state.familyGroup.monthlyBusinessBudget), budgetNote(metrics.businessTotal, state.familyGroup.monthlyBusinessBudget)],
    ["Negocio anterior", formatMoney(metrics.businessPreviousTotal), metrics.previousMonth]
  ].map(([label, value, note]) => metricCard(label, value, note)).join("");

  const personTotals = state.members.map((member) => {
    const memberExpenses = metrics.familyCurrent.filter((expense) => expense.memberId === member.id);
    const categoryTop = topEntry(groupTotal(memberExpenses, (expense) => expense.category));
    const total = sumExpenses(memberExpenses);
    return {
      name: member.name,
      total,
      count: memberExpenses.length,
      percent: (total / familyTotal) * 100,
      category: categoryTop ? categoryTop[0] : "Sin datos"
    };
  });

  document.getElementById("person-report").innerHTML = personTotals.map((item) => `
    <div class="stack-item">
      <strong>${escapeHtml(item.name)}: ${formatMoney(item.total)}</strong>
      <span>${item.count} gastos - ${item.percent.toFixed(1)}% del total - Categoria principal: ${escapeHtml(item.category)}</span>
      ${progressBar(item.percent)}
    </div>
  `).join("");

  document.getElementById("payment-report").innerHTML = state.paymentMethods.map((method) => {
    const usedExpenses = combinedCurrent.filter((expense) => expense.paymentMethodId === method.id);
    const familyUsers = usedExpenses
      .filter((expense) => expense.type === "familiar")
      .map((expense) => findById(state.members, expense.memberId)?.name)
      .filter(Boolean);
    const businessUsers = usedExpenses
      .filter((expense) => expense.type === "negocio")
      .map((expense) => expense.responsible || "Negocio")
      .filter(Boolean);
    const users = [...new Set(familyUsers.concat(businessUsers))];
    const total = sumExpenses(usedExpenses);
    const percent = (total / combinedTotal) * 100;
    const owner = findById(state.members, method.ownerId);
    const overLimit = method.monthlyLimit && total > method.monthlyLimit;

    return `
      <div class="stack-item">
        <strong>${escapeHtml(method.name)}: ${formatMoney(total)}</strong>
        <span>${escapeHtml(method.type)} - Dueno: ${escapeHtml(owner ? owner.name : "Sin dueno")} - Usado por: ${escapeHtml(users.join(", ") || "Sin uso este mes")}</span>
        <span>${method.shared ? "Compartido" : "Individual"}${method.monthlyLimit ? ` - Limite: ${formatMoney(method.monthlyLimit)}` : " - Sin limite"}${overLimit ? " - Sobre limite" : ""}</span>
        ${progressBar(percent)}
      </div>
    `;
  }).join("");

  const categoryTotals = Object.entries(groupTotal(combinedCurrent, (expense) => `${expense.type}: ${expense.category}`))
    .sort((a, b) => b[1] - a[1]);

  document.getElementById("category-report").innerHTML = categoryTotals.length
    ? categoryTotals.map(([name, total]) => `
      <div class="stack-item">
        <strong>${escapeHtml(name)}: ${formatMoney(total)}</strong>
        <span>${((total / combinedTotal) * 100).toFixed(1)}% del gasto total del mes</span>
        ${progressBar((total / combinedTotal) * 100)}
      </div>
    `).join("")
    : emptyMessage("Aun no hay categorias con gasto este mes.");

  document.getElementById("business-report").innerHTML = state.businesses.map((business) => {
    const currentExpenses = metrics.businessCurrent.filter((expense) => expense.businessId === business.id);
    const previousExpenses = metrics.businessPrevious.filter((expense) => expense.businessId === business.id);
    const total = sumExpenses(currentExpenses);
    const previousTotal = sumExpenses(previousExpenses);
    const categoryTop = topEntry(groupTotal(currentExpenses, (expense) => expense.category));
    const highestExpense = getHighestExpense(currentExpenses);
    const percent = metrics.businessTotal ? (total / metrics.businessTotal) * 100 : 0;

    return `
      <div class="stack-item">
        <strong>${escapeHtml(business.name)}: ${formatMoney(total)}</strong>
        <span>Mes anterior: ${formatMoney(previousTotal)} - Categoria top: ${escapeHtml(categoryTop ? categoryTop[0] : "Sin datos")}</span>
        <span>Gasto mas alto: ${highestExpense ? formatMoney(highestExpense.amount) : "Sin datos"}</span>
        ${progressBar(percent, "business")}
      </div>
    `;
  }).join("");
}

function metricCard(label, value, note) {
  return `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `;
}

function renderTextList(elementId, items) {
  document.getElementById(elementId).innerHTML = items.length
    ? items.map((item) => `<div class="insight-item">${escapeHtml(item)}</div>`).join("")
    : `<div class="insight-item">Aun no hay suficientes datos para analizar.</div>`;
}

function progressBar(percent, variant = "") {
  const safePercent = Math.max(0, Math.min(100, percent || 0));
  return `
    <div class="bar-track" aria-hidden="true">
      <span class="bar-fill ${variant}" style="width:${safePercent}%"></span>
    </div>
  `;
}

function emptyMessage(message) {
  return `<div class="stack-item"><span>${escapeHtml(message)}</span></div>`;
}

function statusItem(label, value, note, isWarning = false) {
  return `
    <div class="stack-item">
      <strong class="${isWarning ? "trend-up" : ""}">${escapeHtml(label)}: ${escapeHtml(value)}</strong>
      <span>${escapeHtml(note)}</span>
    </div>
  `;
}

function tableEmptyState(message, columns) {
  return `<tr><td class="empty-state" colspan="${columns}">${escapeHtml(message)}</td></tr>`;
}

function sortExpensesByTime(expenses) {
  return expenses.slice().sort((a, b) => {
    const first = new Date(a.registeredAt || a.date).getTime();
    const second = new Date(b.registeredAt || b.date).getTime();
    return second - first;
  });
}

function filterFamilyExpenses(expenses) {
  const query = getFilterQuery("family-expense-filter");
  if (!query) return expenses;

  return expenses.filter((expense) => {
    const member = findById(state.members, expense.memberId);
    const method = findById(state.paymentMethods, expense.paymentMethodId);
    return matchesQuery([
      expense.date,
      formatTime(expense.registeredAt),
      member?.name,
      expense.category,
      method?.name,
      paymentStatusLabel(expense.paymentStatus),
      expense.description,
      String(expense.amount),
      formatMoney(expense.amount)
    ], query);
  });
}

function filterBusinessExpenses(expenses) {
  const query = getFilterQuery("business-expense-filter");
  if (!query) return expenses;

  return expenses.filter((expense) => {
    const business = findById(state.businesses, expense.businessId);
    const method = findById(state.paymentMethods, expense.paymentMethodId);
    return matchesQuery([
      expense.date,
      formatTime(expense.registeredAt),
      business?.name,
      expense.category,
      method?.name,
      paymentStatusLabel(expense.paymentStatus),
      expense.description,
      expense.vendor,
      expense.responsible,
      String(expense.amount),
      formatMoney(expense.amount)
    ], query);
  });
}

function getFilterQuery(elementId) {
  return cleanText(document.getElementById(elementId)?.value).toLowerCase();
}

function matchesQuery(values, query) {
  return values.some((value) => cleanText(value).toLowerCase().includes(query));
}

function monthTrendText(difference) {
  if (difference > 0) return `${formatMoney(difference)} mas`;
  if (difference < 0) return `${formatMoney(Math.abs(difference))} menos`;
  return "Sin cambio";
}

function budgetNote(total, budget) {
  if (!budget) return "Sin presupuesto";
  const remaining = budget - total;
  const percent = (total / budget) * 100;
  if (remaining < 0) return `${percent.toFixed(1)}% usado - sobre presupuesto`;
  return `${percent.toFixed(1)}% usado - quedan ${formatMoney(remaining)}`;
}

function getHighestExpense(expenses) {
  return expenses.slice().sort((a, b) => b.amount - a.amount)[0] || null;
}

function renderSettings(metrics) {
  const activeMembers = state.members.filter((member) => member.status === "activo").length;
  const totalExpenses = state.expenses.length;
  const localSize = new Blob([JSON.stringify(state)]).size;
  const activeMemberWarning = activeMembers > FREE_PLAN_LIMITS.activeMembers;
  const businessWarning = state.businesses.length > FREE_PLAN_LIMITS.businesses;

  document.getElementById("plan-status").innerHTML = [
    statusItem("Grupos", state.groups.length, "MVP local con multiples grupos separados."),
    statusItem("Miembros activos", `${activeMembers} / ${FREE_PLAN_LIMITS.activeMembers}`, "Limite sugerido para version gratuita.", activeMemberWarning),
    statusItem("Negocios", `${state.businesses.length} / ${FREE_PLAN_LIMITS.businesses}`, "La version premium futura podria permitir mas negocios.", businessWarning),
    statusItem("Reportes", FREE_PLAN_LIMITS.reportLevel, "Base lista para reportes avanzados en premium.")
  ].join("");

  document.getElementById("data-status").innerHTML = [
    statusItem("Miembros", state.members.length, "Personas registradas en el grupo."),
    statusItem("Metodos", state.paymentMethods.length, "Metodos de pago guardados localmente."),
    statusItem("Gastos", totalExpenses, `${metrics.familyCurrent.length} familiares y ${metrics.businessCurrent.length} de negocio en el mes actual.`),
    statusItem("Tamano local", `${(localSize / 1024).toFixed(1)} KB`, "Estimado guardado en este navegador.")
  ].join("");

  const profile = state.userProfile;
  const profileName = profile?.authProvider === "google" ? profile.email : profile?.displayName;
  document.getElementById("profile-status").innerHTML = profile
    ? [
      statusItem(profile.authProvider === "google" ? "Correo" : "Perfil local", profileName, profile.authProvider === "google" ? "Cuenta conectada a Supabase." : "Nombre usado solo para separar datos en este navegador."),
      statusItem("Acceso", profile.authProvider === "google" ? "Google + nube" : "Modo local", profile.authProvider === "google" ? "Cuenta validada por Supabase." : "No requiere contrasena; solo vive en este navegador."),
      statusItem("Uso inicial", usageModeLabel(profile.usageMode), "Define que modulos aparecen primero."),
      statusItem("Registrado", formatDateTime(profile.createdAt), "Fecha y hora del primer acceso local.")
    ].join("")
    : emptyMessage("Todavia no hay perfil local.");

  const settingsForm = document.getElementById("settings-form");
  settingsForm.elements.familyName.value = state.familyGroup.name;
  settingsForm.elements.currency.value = state.familyGroup.currency;
  settingsForm.elements.controlMonth.value = state.familyGroup.controlMonth;
  settingsForm.elements.familyBudget.value = state.familyGroup.monthlyFamilyBudget || "";
  settingsForm.elements.businessBudget.value = state.familyGroup.monthlyBusinessBudget || "";
}

function renderCategorySettings() {
  document.getElementById("family-categories-list").innerHTML = renderCategoryChips("family", getFamilyCategories());
  document.getElementById("business-categories-list").innerHTML = renderCategoryChips("business", getBusinessCategories());
  const metrics = getMetrics();
  document.getElementById("family-category-budgets-list").innerHTML = renderCategoryBudgetList("family", metrics.familyCurrent);
  document.getElementById("business-category-budgets-list").innerHTML = renderCategoryBudgetList("business", metrics.businessCurrent);
}

function renderCategoryBudgetList(type, expenses) {
  const budgets = state.categoryBudgets?.[type] || {};
  const entries = Object.entries(budgets);
  if (!entries.length) return emptyMessage("No hay presupuestos por categoria.");
  const totals = groupTotal(expenses, (expense) => expense.category);
  return entries.map(([category, budget]) => {
    const total = Number(totals[category] || 0);
    const percent = budget ? (total / budget) * 100 : 0;
    const overBudget = percent >= 100;
    return `
      <div class="stack-item">
        <strong class="${overBudget ? "trend-up" : ""}">${escapeHtml(category)}: ${formatMoney(total)} / ${formatMoney(budget)}</strong>
        <span>${percent.toFixed(1)}% usado${overBudget ? " - sobre presupuesto" : ""}</span>
        ${progressBar(percent, overBudget ? "danger" : "")}
      </div>
    `;
  }).join("");
}

function renderGroupSelector() {
  const select = document.getElementById("active-group-select");
  const activeGroups = state.groups.filter((group) => !group.archived);
  select.innerHTML = activeGroups.map((group) => `
    <option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>
  `).join("");
  select.value = state.activeGroupId;
}

function renderGroups() {
  const mayManage = canManageGroup();
  const activeGroups = state.groups.filter((group) => !group.archived);
  const archivedGroups = state.groups.filter((group) => group.archived);
  document.getElementById("active-groups-count").textContent = `${activeGroups.length} activos`;
  document.getElementById("archived-groups-count").textContent = `${archivedGroups.length} archivados`;
  document.getElementById("active-groups-list").innerHTML = activeGroups.length
    ? activeGroups.map((group) => groupCard(group, mayManage)).join("")
    : emptyMessage("No hay grupos activos.");
  document.getElementById("archived-groups-list").innerHTML = archivedGroups.length
    ? archivedGroups.map((group) => groupCard(group, mayManage)).join("")
    : emptyMessage("No hay grupos archivados.");
}

function groupCard(group, mayManage) {
    const admin = findById(group.members, group.adminMemberId);
    const isActive = group.id === state.activeGroupId;
    return `
      <article class="data-card">
        <header>
          <h2>${escapeHtml(group.name)}</h2>
          <span class="tag">${escapeHtml(group.archived ? "archivado" : group.type)}</span>
        </header>
        <p class="muted">Admin: ${escapeHtml(admin ? admin.name : "Sin admin")}${group.adminEmail ? ` - ${escapeHtml(group.adminEmail)}` : ""}</p>
        <p class="muted">${group.members.length} miembros - ${group.expenses.length} gastos - ${group.invitations.length} invitaciones</p>
        <div class="button-row">
          <button class="secondary-mini" data-switch-group="${group.id}">${isActive ? "Activo" : "Usar"}</button>
          ${mayManage && !group.archived ? `<button class="secondary-mini" data-archive-group="${group.id}">Archivar</button>` : ""}
          ${mayManage && group.archived ? `<button class="secondary-mini" data-restore-group="${group.id}">Restaurar</button>` : ""}
          ${mayManage ? `<button class="inline-danger" data-delete-group="${group.id}">Eliminar</button>` : ""}
        </div>
      </article>
    `;
}

function renderInvitations() {
  const mayManage = canManageGroup();
  const invitations = state.invitations || [];
  document.getElementById("invitations-list").innerHTML = invitations.length
    ? invitations.map((invite) => `
      <div class="stack-item">
        <strong>${escapeHtml(invite.name)} - ${escapeHtml(invite.role)}</strong>
        <span>${escapeHtml(invite.email)} - ${escapeHtml(invite.status)}</span>
        <span>${escapeHtml(getInviteUrl(invite.inviteCode))}</span>
        <div class="button-row">
          <button class="secondary-mini" data-copy-invite="${invite.inviteCode}">Copiar link</button>
          ${mayManage && invite.status === "pendiente" ? `<button class="secondary-mini" data-accept-invite="${invite.id}">Aceptar</button>` : ""}
          ${mayManage ? `<button class="inline-danger" data-cancel-invite="${invite.id}">Eliminar</button>` : ""}
        </div>
      </div>
    `).join("")
    : emptyMessage("No hay invitaciones para este grupo.");
}

function getInviteUrl(inviteCode) {
  const baseUrl = window.location.href.split("#")[0];
  return `${baseUrl}#invite=${encodeURIComponent(inviteCode)}`;
}

function renderAdminTransfer() {
  const group = getActiveGroup();
  const admin = findById(state.members, group.adminMemberId);
  document.getElementById("admin-status").innerHTML = statusItem(
    "Admin actual",
    admin ? admin.name : "Sin admin",
    group.adminEmail || "Sin correo"
  );
  fillSelect("transfer-admin-form", "newAdminId", state.members, "name");
}

function renderActivity() {
  const activity = (state.activity || []).slice(0, 12);
  document.getElementById("activity-list").innerHTML = activity.length
    ? activity.map((item) => `
      <div class="stack-item">
        <strong>${escapeHtml(item.action)}</strong>
        <span>${escapeHtml(item.detail)} - ${formatDateTime(item.createdAt)} - ${escapeHtml(item.actorName)} (${escapeHtml(item.actorRole)})</span>
      </div>
    `).join("")
    : emptyMessage("Aun no hay actividad registrada en este grupo.");
}

function logActivity(action, detail) {
  const actor = getCurrentUserMember();
  state.activity.unshift({
    id: createId("activity"),
    action,
    detail,
    actorName: actor?.name || "Usuario local",
    actorRole: getCurrentUserRole(),
    createdAt: getCurrentTimestamp()
  });
  state.activity = state.activity.slice(0, 50);
}

function renderCategoryChips(type, categories) {
  const defaults = type === "family" ? FAMILY_CATEGORIES : BUSINESS_CATEGORIES;
  return categories.map((category) => {
    const isDefault = defaults.includes(category);
    return `
      <span class="category-chip">
        ${escapeHtml(category)}
        ${isDefault ? "" : `<button class="chip-remove" data-remove-category="${type}" data-category-name="${escapeHtml(category)}" title="Eliminar categoria">x</button>`}
      </span>
    `;
  }).join("");
}

function usageModeLabel(mode) {
  if (mode === "family") return "Gastos familiares";
  if (mode === "business") return "Gastos de negocio";
  return "Familia y negocio";
}

function formatDateTime(timestamp) {
  if (!timestamp) return "Sin fecha";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  return new Intl.DateTimeFormat("es-PA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(date);
}

function shouldShowScope(scope) {
  const mode = state.userProfile?.usageMode || "both";
  return !scope || mode === "both" || scope === mode;
}

function applyProfileMode() {
  document.querySelectorAll("[data-scope]").forEach((element) => {
    element.hidden = !shouldShowScope(element.dataset.scope);
  });
}

function showAppOrOnboarding() {
  const hasProfile = Boolean(state.userProfile);
  document.getElementById("onboarding").hidden = hasProfile;
  document.getElementById("app-shell").hidden = !hasProfile;
}

function populateForms() {
  fillSelect("family-expense-form", "memberId", state.members.filter((member) => member.status === "activo"), "name");
  fillSelect("family-expense-form", "category", getFamilyCategories().map((name) => ({ id: name, name })), "name");
  fillSelect("family-expense-form", "paymentMethodId", state.paymentMethods, "name");
  fillSelect("payment-form", "ownerId", state.members.filter((member) => member.status === "activo"), "name");
  fillSelect("business-expense-form", "businessId", state.businesses, "name");
  fillSelect("business-expense-form", "category", getBusinessCategories().map((name) => ({ id: name, name })), "name");
  fillSelect("business-expense-form", "paymentMethodId", state.paymentMethods, "name");
  fillSelect("family-category-budget-form", "categoryName", getFamilyCategories().map((name) => ({ id: name, name })), "name");
  fillSelect("business-category-budget-form", "categoryName", getBusinessCategories().map((name) => ({ id: name, name })), "name");
  renderPaymentMemberOptions();
  setDefaultDates();
}

function fillSelect(formId, fieldName, items, labelKey) {
  const select = document.querySelector(`#${formId} [name="${fieldName}"]`);
  if (!select) return;
  if (!items.length) {
    select.innerHTML = `<option value="">Sin opciones disponibles</option>`;
    return;
  }
  select.innerHTML = items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item[labelKey])}</option>`).join("");
}

function renderPaymentMemberOptions() {
  const container = document.getElementById("payment-members-options");
  container.innerHTML = state.members.filter((member) => member.status === "activo").map((member) => `
    <label class="checkbox-option">
      <input type="checkbox" name="allowedMemberIds" value="${member.id}">
      ${escapeHtml(member.name)}
    </label>
  `).join("");
}

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    if (!input.value) input.value = today;
  });
}

function setupNavigation() {
  const menuToggle = document.getElementById("menu-toggle");
  const sidebarOverlay = document.getElementById("sidebar-overlay");

  function closeMenu() {
    document.body.classList.remove("menu-open");
    if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
  }

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      const isOpen = document.body.classList.toggle("menu-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", closeMenu);
  }

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.view);
      closeMenu();
    });
  });

  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => navigateTo(button.dataset.jump));
  });

  document.getElementById("active-group-select").addEventListener("change", (event) => {
    switchGroup(event.target.value);
  });

  setupMobileSelectSheet();
}

function setupMobileSelectSheet() {
  const sheet = document.createElement("div");
  const panel = document.createElement("div");
  sheet.className = "mobile-select-sheet";
  panel.className = "mobile-select-panel";
  sheet.appendChild(panel);
  document.body.appendChild(sheet);

  function closeSheet() {
    sheet.classList.remove("open");
    panel.replaceChildren();
  }

  function openSheet(select) {
    if (!window.matchMedia("(max-width: 640px)").matches || select.disabled) return;
    const label = select.closest("label");
    const titleText = label ? label.childNodes[0]?.textContent?.trim() : "Seleccionar opcion";
    const title = document.createElement("div");
    title.className = "mobile-select-title";
    title.textContent = titleText || "Seleccionar opcion";
    panel.replaceChildren(title);

    Array.from(select.options).forEach((option) => {
      const button = document.createElement("button");
      button.className = "mobile-select-option";
      button.type = "button";
      button.textContent = option.textContent;
      button.disabled = option.disabled;
      button.classList.toggle("active", option.value === select.value);
      button.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        closeSheet();
      });
      panel.appendChild(button);
    });

    const cancel = document.createElement("button");
    cancel.className = "mobile-select-cancel";
    cancel.type = "button";
    cancel.textContent = "Cancelar";
    cancel.addEventListener("click", closeSheet);
    panel.appendChild(cancel);
    sheet.classList.add("open");
  }

  function handleSelectStart(event) {
    const select = event.target.closest("select");
    if (!select || !window.matchMedia("(max-width: 640px)").matches) return;
    event.preventDefault();
    openSheet(select);
  }

  document.addEventListener("pointerdown", handleSelectStart, true);
  document.addEventListener("mousedown", handleSelectStart, true);
  document.addEventListener("touchstart", handleSelectStart, true);
  document.addEventListener("click", handleSelectStart, true);

  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) closeSheet();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSheet();
  });
}

function setupActions() {
  document.addEventListener("click", (event) => {
    const editMemberButton = event.target.closest("[data-edit-member]");
    if (editMemberButton) {
      startEditMember(editMemberButton.dataset.editMember);
      return;
    }

    const editPaymentButton = event.target.closest("[data-edit-payment]");
    if (editPaymentButton) {
      startEditPayment(editPaymentButton.dataset.editPayment);
      return;
    }

    const editBusinessButton = event.target.closest("[data-edit-business]");
    if (editBusinessButton) {
      startEditBusiness(editBusinessButton.dataset.editBusiness);
      return;
    }

    const editButton = event.target.closest("[data-edit-expense]");
    if (editButton) {
      startEditExpense(editButton.dataset.editExpense);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-expense]");
    if (deleteButton) {
      deleteExpense(deleteButton.dataset.deleteExpense);
      return;
    }

    const removeMemberButton = event.target.closest("[data-remove-member]");
    if (removeMemberButton) {
      removeMember(removeMemberButton.dataset.removeMember);
      return;
    }

    const removeCategoryButton = event.target.closest("[data-remove-category]");
    if (removeCategoryButton) {
      removeCategory(removeCategoryButton.dataset.removeCategory, removeCategoryButton.dataset.categoryName);
      return;
    }

    const switchGroupButton = event.target.closest("[data-switch-group]");
    if (switchGroupButton) {
      switchGroup(switchGroupButton.dataset.switchGroup);
      return;
    }

    const archiveGroupButton = event.target.closest("[data-archive-group]");
    if (archiveGroupButton) {
      archiveGroup(archiveGroupButton.dataset.archiveGroup);
      return;
    }

    const restoreGroupButton = event.target.closest("[data-restore-group]");
    if (restoreGroupButton) {
      restoreGroup(restoreGroupButton.dataset.restoreGroup);
      return;
    }

    const copyInviteButton = event.target.closest("[data-copy-invite]");
    if (copyInviteButton) {
      copyInviteLink(copyInviteButton.dataset.copyInvite);
      return;
    }

    const deleteGroupButton = event.target.closest("[data-delete-group]");
    if (deleteGroupButton) {
      deleteGroup(deleteGroupButton.dataset.deleteGroup);
      return;
    }

    const acceptInviteButton = event.target.closest("[data-accept-invite]");
    if (acceptInviteButton) {
      acceptInvitation(acceptInviteButton.dataset.acceptInvite);
      return;
    }

    const cancelInviteButton = event.target.closest("[data-cancel-invite]");
    if (cancelInviteButton) {
      cancelInvitation(cancelInviteButton.dataset.cancelInvite);
    }
  });
}

function switchGroup(groupId) {
  const group = findById(state.groups, groupId);
  if (!group || group.archived) {
    showToast("No puedes activar un grupo archivado.");
    renderGroupSelector();
    return;
  }
  state.activeGroupId = groupId;
  editingExpenseId = null;
  editingMemberId = null;
  editingPaymentId = null;
  editingBusinessId = null;
  applyActiveGroup();
  saveData();
  render();
  showToast("Grupo activo cambiado.");
}

function archiveGroup(groupId) {
  if (!requireGroupManager()) return;
  const group = findById(state.groups, groupId);
  const activeGroups = state.groups.filter((item) => !item.archived);
  if (!group || group.archived) return;
  if (activeGroups.length <= 1) {
    showToast("Necesitas al menos un grupo activo.");
    return;
  }
  if (!confirm(`Archivar el grupo ${group.name}? No se borraran sus datos.`)) return;

  group.archived = true;
  if (state.activeGroupId === group.id) {
    state.activeGroupId = state.groups.find((item) => !item.archived).id;
    applyActiveGroup();
  }
  logActivity("Grupo archivado", group.name);
  saveData();
  render();
  showToast("Grupo archivado.");
}

function restoreGroup(groupId) {
  if (!requireGroupManager()) return;
  const group = findById(state.groups, groupId);
  if (!group || !group.archived) return;

  group.archived = false;
  logActivity("Grupo restaurado", group.name);
  saveData();
  render();
  showToast("Grupo restaurado.");
}

function copyInviteLink(inviteCode) {
  const url = getInviteUrl(inviteCode);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => showToast("Link de invitacion copiado."))
      .catch(() => showToast("No se pudo copiar el link."));
    return;
  }

  showToast("Copia el link visible en la invitacion.");
}

function deleteGroup(groupId) {
  if (!requireGroupManager()) return;
  const group = findById(state.groups, groupId);
  if (!group) return;
  if (state.groups.length === 1) {
    showToast("No puedes eliminar el unico grupo.");
    return;
  }
  if (!confirm(`Eliminar el grupo ${group.name}? Esta accion borra sus datos locales.`)) return;

  state.groups = state.groups.filter((item) => item.id !== groupId);
  if (state.activeGroupId === groupId) {
    state.activeGroupId = state.groups[0].id;
  }
  applyActiveGroup();
  logActivity("Grupo eliminado", group.name);
  saveData();
  render();
  showToast("Grupo eliminado.");
}

function createInvitation(name, email, role) {
  return {
    id: createId("invite"),
    name: cleanText(name),
    email: cleanText(email).toLowerCase(),
    role: role || "miembro",
    status: "pendiente",
    inviteCode: `destin-flow-invite-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: getCurrentTimestamp()
  };
}

function acceptInvitation(inviteId) {
  if (!requireGroupManager()) return;
  const invite = findById(state.invitations, inviteId);
  if (!invite || invite.status !== "pendiente") return;

  const member = createMember(invite.name, invite.role, "#146c72", "activo");
  member.email = invite.email;
  state.members.push(member);
  invite.status = "aceptada";
  invite.acceptedAt = getCurrentTimestamp();
  logActivity("Invitacion aceptada", `${invite.name} - ${invite.email}`);
  saveData();
  render();
  showToast("Invitacion aceptada. Miembro agregado.");
}

function cancelInvitation(inviteId) {
  if (!requireGroupManager()) return;
  const invite = findById(state.invitations, inviteId);
  if (!invite) return;
  if (!confirm(`Eliminar la invitacion para ${invite.email}?`)) return;

  state.invitations = state.invitations.filter((item) => item.id !== inviteId);
  logActivity("Invitacion eliminada", invite.email);
  saveData();
  render();
  showToast("Invitacion eliminada.");
}

function acceptInvitationFromHash() {
  const hash = window.location.hash || "";
  if (!hash.startsWith("#invite=")) return;
  const inviteCode = decodeURIComponent(hash.replace("#invite=", ""));
  const group = state.groups.find((item) => (item.invitations || []).some((invite) => invite.inviteCode === inviteCode));
  if (!group) {
    showToast("Invitacion no encontrada en este navegador.");
    return;
  }

  state.activeGroupId = group.id;
  applyActiveGroup();
  const invite = state.invitations.find((item) => item.inviteCode === inviteCode);
  if (!invite) return;
  if (invite.status === "pendiente") {
    const member = createMember(invite.name, invite.role, "#146c72", "activo");
    member.email = invite.email;
    state.members.push(member);
    invite.status = "aceptada";
    invite.acceptedAt = getCurrentTimestamp();
    logActivity("Invitacion aceptada por link", `${invite.name} - ${invite.email}`);
    saveData();
  }
  window.location.hash = "";
  render();
  showToast("Invitacion aceptada. Grupo activado.");
}

function transferAdmin(newAdminId) {
  if (!requireGroupManager()) return;
  const group = getActiveGroup();
  const nextAdmin = findById(state.members, newAdminId);
  const currentAdmin = findById(state.members, group.adminMemberId);
  if (!nextAdmin) return;
  if (nextAdmin.id === group.adminMemberId) {
    showToast("Ese miembro ya es admin.");
    return;
  }
  if (!confirm(`Transferir administracion a ${nextAdmin.name}?`)) return;

  if (currentAdmin && currentAdmin.role === "admin") {
    currentAdmin.role = "miembro";
  }
  nextAdmin.role = "admin";
  group.adminMemberId = nextAdmin.id;
  group.adminEmail = nextAdmin.email || group.adminEmail;
  logActivity("Admin transferido", `${currentAdmin?.name || "Admin anterior"} -> ${nextAdmin.name}`);
  saveData();
  render();
  showToast("Administrador transferido.");
}

function startEditMember(memberId) {
  if (!requireEditor()) return;
  const member = findById(state.members, memberId);
  if (!member) return;
  editingMemberId = memberId;
  const form = document.getElementById("member-form");
  form.elements.name.value = member.name;
  form.elements.role.value = member.role;
  form.elements.color.value = member.color;
  form.elements.status.value = member.status;
  form.querySelector("button[type='submit']").textContent = "Actualizar miembro";
  navigateTo("members");
  showToast("Editando miembro.");
}

function startEditPayment(paymentId) {
  if (!requireEditor()) return;
  const method = findById(state.paymentMethods, paymentId);
  if (!method) return;
  editingPaymentId = paymentId;
  const form = document.getElementById("payment-form");
  form.elements.name.value = method.name;
  form.elements.type.value = method.type;
  form.elements.ownerId.value = method.ownerId;
  form.elements.monthlyLimit.value = method.monthlyLimit || "";
  form.elements.shared.value = String(Boolean(method.shared));
  form.querySelectorAll('[name="allowedMemberIds"]').forEach((input) => {
    input.checked = method.allowedMemberIds.includes(input.value);
  });
  form.querySelector("button[type='submit']").textContent = "Actualizar metodo";
  navigateTo("payments");
  showToast("Editando metodo de pago.");
}

function startEditBusiness(businessId) {
  if (!requireEditor()) return;
  const business = findById(state.businesses, businessId);
  if (!business) return;
  editingBusinessId = businessId;
  const form = document.getElementById("business-form");
  form.elements.name.value = business.name;
  form.elements.type.value = business.type;
  form.elements.currency.value = business.currency;
  form.elements.description.value = business.description || "";
  form.querySelector("button[type='submit']").textContent = "Actualizar negocio";
  navigateTo("business");
  showToast("Editando negocio.");
}

function finishBaseEdit(form, defaultText) {
  form.querySelector("button[type='submit']").textContent = defaultText;
}

function startEditExpense(expenseId) {
  if (!requireEditor()) return;
  const expense = findById(state.expenses, expenseId);
  if (!expense) return;
  editingExpenseId = expenseId;

  if (expense.type === "familiar") {
    navigateTo("family-expense");
    const form = document.getElementById("family-expense-form");
    form.elements.amount.value = expense.amount;
    form.elements.date.value = expense.date;
    form.elements.memberId.value = expense.memberId;
    form.elements.category.value = expense.category;
    form.elements.paymentMethodId.value = expense.paymentMethodId;
    form.elements.paymentStatus.value = normalizePaymentStatus(expense.paymentStatus);
    form.elements.description.value = expense.description || "";
    form.querySelector("button[type='submit']").textContent = "Actualizar gasto familiar";
  } else {
    navigateTo("business-expense");
    const form = document.getElementById("business-expense-form");
    form.elements.businessId.value = expense.businessId;
    form.elements.amount.value = expense.amount;
    form.elements.date.value = expense.date;
    form.elements.category.value = expense.category;
    form.elements.paymentMethodId.value = expense.paymentMethodId;
    form.elements.paymentStatus.value = normalizePaymentStatus(expense.paymentStatus);
    form.elements.vendor.value = expense.vendor || "";
    form.elements.responsible.value = expense.responsible || "";
    form.elements.description.value = expense.description || "";
    form.querySelector("button[type='submit']").textContent = "Actualizar gasto de negocio";
  }

  showToast("Editando gasto. Guarda para actualizar.");
}

function finishExpenseEdit(form) {
  editingExpenseId = null;
  form.querySelector("button[type='submit']").textContent = form.id === "family-expense-form"
    ? "Guardar gasto familiar"
    : "Guardar gasto de negocio";
}

function setupFilters() {
  ["family-expense-filter", "business-expense-filter"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      render();
    });
  });
}

function deleteExpense(expenseId) {
  if (!requireEditor()) return;
  const expense = findById(state.expenses, expenseId);
  if (!expense) return;
  const label = `${expense.category} por ${formatMoney(expense.amount)}`;
  if (!confirm(`Eliminar este gasto: ${label}?`)) return;

  state.expenses = state.expenses.filter((item) => item.id !== expenseId);
  window.dispatchEvent(new CustomEvent("destin-flow:expense-delete", {
    detail: {
      expense,
      activeGroupId: state.activeGroupId
    }
  }));
  logActivity("Gasto eliminado", label);
  saveData();
  render();
  showToast("Gasto eliminado.");
}

function removeMember(memberId) {
  if (!requireGroupManager()) return;
  const group = getActiveGroup();
  const member = findById(state.members, memberId);
  if (!member) return;
  if (member.id === group.adminMemberId) {
    showToast("No puedes expulsar al admin actual.");
    return;
  }
  if (state.members.length <= 1) {
    showToast("El grupo necesita al menos un miembro.");
    return;
  }
  const hasExpenses = state.expenses.some((expense) => expense.memberId === memberId);
  const message = hasExpenses
    ? `Expulsar a ${member.name}? Sus gastos historicos se conservaran.`
    : `Expulsar a ${member.name}?`;
  if (!confirm(message)) return;

  state.members = state.members.filter((item) => item.id !== memberId);
  state.paymentMethods.forEach((method) => {
    method.allowedMemberIds = method.allowedMemberIds.filter((id) => id !== memberId);
    if (method.ownerId === memberId) {
      method.ownerId = group.adminMemberId;
    }
  });
  logActivity("Miembro expulsado", member.name);
  saveData();
  render();
  showToast("Miembro expulsado.");
}

function removeCategory(type, categoryName) {
  const expenseType = type === "family" ? "familiar" : "negocio";
  const hasExpenses = state.expenses.some((expense) => expense.type === expenseType && expense.category === categoryName);
  if (hasExpenses) {
    showToast("No se puede eliminar una categoria con gastos.");
    return;
  }
  if (!confirm(`Eliminar la categoria ${categoryName}?`)) return;

  state.categories[type] = state.categories[type].filter((category) => category !== categoryName);
  if (state.categoryBudgets?.[type]) delete state.categoryBudgets[type][categoryName];
  logActivity("Categoria eliminada", categoryName);
  saveData();
  render();
  showToast("Categoria eliminada.");
}

function addCategory(type, categoryName) {
  const name = cleanText(categoryName);
  if (!name) return;
  const existing = state.categories[type].map((category) => category.toLowerCase());
  if (existing.includes(name.toLowerCase())) {
    showToast("Esa categoria ya existe.");
    return;
  }

  state.categories[type].push(name);
  logActivity("Categoria agregada", `${type}: ${name}`);
  saveData();
  render();
  showToast("Categoria agregada.");
}

function saveCategoryBudget(type, categoryName, amount) {
  const category = cleanText(categoryName);
  if (!category || !state.categories[type].includes(category)) {
    showToast("Selecciona una categoria valida.");
    return;
  }

  setCategoryBudget(type, category, amount);
  logActivity("Presupuesto de categoria actualizado", `${category} - ${formatMoney(Number(amount || 0))}`);
  saveData();
  render();
  showToast(Number(amount || 0) > 0 ? "Presupuesto de categoria guardado." : "Presupuesto de categoria quitado.");
}

function navigateTo(viewId) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewId);
  });
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active-view"));
  document.getElementById(viewId).classList.add("active-view");
  document.getElementById("view-title").textContent = titles[viewId];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2400);
}

function setupForms() {
  document.getElementById("onboarding-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const localName = cleanText(form.get("localName"));
    state = loadDataForUser(
      createLocalIdentifier(localName),
      form.get("usageMode") || "both",
      "local",
      localName
    );
    showAppOrOnboarding();
    render();
    showToast("Perfil local cargado.");
  });

  document.getElementById("group-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireGroupManager()) return;
    const form = new FormData(event.currentTarget);
    const name = cleanText(form.get("groupName"));
    const adminName = cleanText(form.get("adminName"));
    const adminEmail = cleanText(form.get("adminEmail"));
    if (!name || !adminName || !adminEmail) return;

    const group = createGroup(name, form.get("groupType"), adminName, adminEmail);
    state.groups.push(group);
    state.activeGroupId = group.id;
    applyActiveGroup();
    logActivity("Grupo creado", group.name);
    saveData();
    event.currentTarget.reset();
    render();
    showToast("Grupo creado y activado.");
  });

  document.getElementById("invite-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireGroupManager()) return;
    const form = new FormData(event.currentTarget);
    const name = cleanText(form.get("inviteName"));
    const email = cleanText(form.get("inviteEmail"));
    if (!name || !email) return;

    state.invitations.push(createInvitation(name, email, form.get("inviteRole")));
    logActivity("Invitacion creada", `${name} - ${email}`);
    saveData();
    event.currentTarget.reset();
    render();
    showToast("Invitacion creada.");
  });

  document.getElementById("transfer-admin-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireGroupManager()) return;
    const form = new FormData(event.currentTarget);
    transferAdmin(form.get("newAdminId"));
  });

  document.getElementById("member-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireEditor()) return;
    const form = new FormData(event.currentTarget);
    const name = cleanText(form.get("name"));
    if (!name) return;

    const existingMember = editingMemberId ? findById(state.members, editingMemberId) : null;
    if (existingMember) {
      Object.assign(existingMember, {
        name,
        role: form.get("role"),
        color: form.get("color"),
        status: form.get("status")
      });
    } else {
      state.members.push(createMember(
        name,
        form.get("role"),
        form.get("color"),
        form.get("status")
      ));
    }
    logActivity(existingMember ? "Miembro actualizado" : "Miembro creado", name);
    saveData();
    event.currentTarget.reset();
    editingMemberId = null;
    finishBaseEdit(event.currentTarget, "Guardar miembro");
    render();
    showToast(existingMember ? "Miembro actualizado." : "Miembro guardado.");
  });

  document.getElementById("payment-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireEditor()) return;
    const form = new FormData(event.currentTarget);
    const name = cleanText(form.get("name"));
    const ownerId = form.get("ownerId");
    if (!name || !ownerId) return;

    const existingPayment = editingPaymentId ? findById(state.paymentMethods, editingPaymentId) : null;
    const nextMethod = createPaymentMethod(
      name,
      form.get("type"),
      ownerId,
      form.get("monthlyLimit"),
      form.get("shared"),
      form.getAll("allowedMemberIds")
    );
    if (existingPayment) {
      Object.assign(existingPayment, {
        name: nextMethod.name,
        type: nextMethod.type,
        ownerId: nextMethod.ownerId,
        monthlyLimit: nextMethod.monthlyLimit,
        shared: nextMethod.shared,
        allowedMemberIds: nextMethod.allowedMemberIds
      });
    } else {
      state.paymentMethods.push(nextMethod);
    }
    logActivity(existingPayment ? "Metodo actualizado" : "Metodo creado", name);
    saveData();
    event.currentTarget.reset();
    editingPaymentId = null;
    finishBaseEdit(event.currentTarget, "Guardar metodo");
    render();
    showToast(existingPayment ? "Metodo de pago actualizado." : "Metodo de pago guardado.");
  });

  document.getElementById("business-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireEditor()) return;
    const form = new FormData(event.currentTarget);
    const name = cleanText(form.get("name"));
    const type = cleanText(form.get("type"));
    if (!name || !type) return;

    const existingBusiness = editingBusinessId ? findById(state.businesses, editingBusinessId) : null;
    if (existingBusiness) {
      Object.assign(existingBusiness, {
        name,
        type,
        currency: cleanText(form.get("currency") || "USD").toUpperCase(),
        description: cleanText(form.get("description"))
      });
    } else {
      state.businesses.push(createBusiness(
        name,
        type,
        form.get("currency"),
        form.get("description")
      ));
    }
    logActivity(existingBusiness ? "Negocio actualizado" : "Negocio creado", name);
    saveData();
    event.currentTarget.reset();
    editingBusinessId = null;
    finishBaseEdit(event.currentTarget, "Guardar negocio");
    render();
    showToast(existingBusiness ? "Negocio actualizado." : "Negocio guardado.");
  });

  document.getElementById("settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireEditor()) return;
    const form = new FormData(event.currentTarget);
    state.familyGroup.name = cleanText(form.get("familyName")) || state.familyGroup.name;
    state.familyGroup.currency = cleanText(form.get("currency") || "USD").toUpperCase();
    state.familyGroup.controlMonth = form.get("controlMonth") || state.familyGroup.controlMonth;
    state.familyGroup.monthlyFamilyBudget = Number(form.get("familyBudget") || 0);
    state.familyGroup.monthlyBusinessBudget = Number(form.get("businessBudget") || 0);
    logActivity("Configuracion actualizada", state.familyGroup.name);
    saveData();
    render();
    showToast("Configuracion guardada.");
  });

  document.getElementById("family-category-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireEditor()) return;
    const form = new FormData(event.currentTarget);
    addCategory("family", form.get("categoryName"));
    event.currentTarget.reset();
  });

  document.getElementById("family-category-budget-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireEditor()) return;
    const form = new FormData(event.currentTarget);
    saveCategoryBudget("family", form.get("categoryName"), form.get("categoryBudget"));
    event.currentTarget.reset();
  });

  document.getElementById("business-category-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireEditor()) return;
    const form = new FormData(event.currentTarget);
    addCategory("business", form.get("categoryName"));
    event.currentTarget.reset();
  });

  document.getElementById("business-category-budget-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireEditor()) return;
    const form = new FormData(event.currentTarget);
    saveCategoryBudget("business", form.get("categoryName"), form.get("categoryBudget"));
    event.currentTarget.reset();
  });

  document.getElementById("family-expense-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireEditor()) return;
    const form = new FormData(event.currentTarget);
    const existingExpense = editingExpenseId ? findById(state.expenses, editingExpenseId) : null;
    if (existingExpense && existingExpense.type === "familiar") {
      Object.assign(existingExpense, {
        amount: Number(form.get("amount")),
        date: form.get("date"),
        memberId: form.get("memberId"),
        category: form.get("category"),
        paymentMethodId: form.get("paymentMethodId"),
        paymentStatus: normalizePaymentStatus(form.get("paymentStatus")),
        description: form.get("description") || "",
        updatedAt: getCurrentTimestamp()
      });
    } else {
      state.expenses.push(createFamilyExpense(
        form.get("amount"),
        form.get("date"),
        form.get("memberId"),
        form.get("category"),
        form.get("paymentMethodId"),
        form.get("description"),
        undefined,
        form.get("paymentStatus")
      ));
    }
    logActivity(existingExpense ? "Gasto familiar actualizado" : "Gasto familiar creado", `${form.get("category")} - ${formatMoney(Number(form.get("amount")))}`);
    saveData();
    event.currentTarget.reset();
    finishExpenseEdit(event.currentTarget);
    render();
    showToast(existingExpense ? "Gasto familiar actualizado." : "Gasto familiar guardado con hora exacta.");
  });

  document.getElementById("business-expense-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireEditor()) return;
    const form = new FormData(event.currentTarget);
    const existingExpense = editingExpenseId ? findById(state.expenses, editingExpenseId) : null;
    if (existingExpense && existingExpense.type === "negocio") {
      Object.assign(existingExpense, {
        amount: Number(form.get("amount")),
        date: form.get("date"),
        businessId: form.get("businessId"),
        category: form.get("category"),
        paymentMethodId: form.get("paymentMethodId"),
        paymentStatus: normalizePaymentStatus(form.get("paymentStatus")),
        description: form.get("description") || "",
        vendor: form.get("vendor") || "",
        responsible: form.get("responsible") || "",
        updatedAt: getCurrentTimestamp()
      });
    } else {
      state.expenses.push(createBusinessExpense(
        form.get("amount"),
        form.get("date"),
        form.get("businessId"),
        form.get("category"),
        form.get("paymentMethodId"),
        form.get("description"),
        form.get("vendor"),
        form.get("responsible"),
        undefined,
        form.get("paymentStatus")
      ));
    }
    logActivity(existingExpense ? "Gasto negocio actualizado" : "Gasto negocio creado", `${form.get("category")} - ${formatMoney(Number(form.get("amount")))}`);
    saveData();
    event.currentTarget.reset();
    finishExpenseEdit(event.currentTarget);
    render();
    showToast(existingExpense ? "Gasto de negocio actualizado." : "Gasto de negocio guardado con hora exacta.");
  });

  document.getElementById("reset-demo-data").addEventListener("click", () => {
    const profile = state.userProfile;
    state = normalizeData(createSeedData());
    state.userProfile = profile;
    saveData();
    render();
    showToast("Datos de prueba restaurados.");
  });

  document.getElementById("download-backup").addEventListener("click", () => {
    downloadBackup();
    showToast("Copia JSON descargada.");
  });

  document.getElementById("quick-save").addEventListener("click", () => {
    saveData();
    renderSaveStatus();
    renderSyncStatus();
    showToast("Datos guardados localmente.");
  });

  document.getElementById("export-family-csv").addEventListener("click", () => {
    exportExpensesCsv("familiar");
  });

  document.getElementById("export-business-csv").addEventListener("click", () => {
    exportExpensesCsv("negocio");
  });

  document.getElementById("export-all-csv").addEventListener("click", () => {
    exportExpensesCsv("todos");
  });

  document.getElementById("import-backup").addEventListener("change", (event) => {
    const file = event.currentTarget.files[0];
    if (!file) return;
    importBackup(file);
    event.currentTarget.value = "";
  });

  document.getElementById("restart-onboarding").addEventListener("click", () => {
    if (!confirm("Quieres volver a configurar el correo y el tipo de uso inicial?")) return;
    saveData();
    clearStorageSession();
    state = normalizeData(createSeedData());
    saveData(state, { markDirty: false });
    showAppOrOnboarding();
  });

  document.getElementById("sign-out-app").addEventListener("click", async () => {
    if (!confirm("Cerrar sesion y volver al inicio? Tus datos locales se conservaran.")) return;
    if (window.DestinFlowCloud?.signOut) {
      await window.DestinFlowCloud.signOut();
    } else if (window.supabase && window.DESTIN_FLOW_CLOUD?.enabled) {
      const client = window.supabase.createClient(
        window.DESTIN_FLOW_CLOUD.supabaseUrl,
        window.DESTIN_FLOW_CLOUD.supabaseAnonKey
      );
      await client.auth.signOut();
    }
    saveData();
    clearStorageSession();
    state = normalizeData(createSeedData());
    saveData(state, { markDirty: false });
    showAppOrOnboarding();
    showToast("Sesion cerrada.");
  });

  document.getElementById("clear-data").addEventListener("click", () => {
    if (!confirm("Seguro que quieres borrar los datos locales de Destin Flow?")) return;
    const profile = state.userProfile;
    localStorage.removeItem(STORAGE_KEY);
    state = normalizeData(createSeedData());
    state.userProfile = profile;
    saveData();
    render();
    showToast("Datos locales limpiados.");
  });
}

function downloadBackup() {
  const backup = {
    app: "Destin Flow",
    version: "mvp-local",
    exportedAt: getCurrentTimestamp(),
    data: state
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `destin-flow-backup-${getCurrentTimestamp().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportExpensesCsv(type) {
  const expenses = state.expenses
    .filter((expense) => type === "todos" || expense.type === type)
    .sort((a, b) => new Date(b.registeredAt || b.date) - new Date(a.registeredAt || a.date));
  const rows = expenses.map(expenseToCsvRow);
  const csv = [
    ["tipo", "fecha", "hora", "monto", "estado", "categoria", "miembro", "negocio", "metodo_pago", "dueno_metodo", "compartido", "descripcion", "proveedor", "responsable"].join(","),
    ...rows
  ].join("\n");
  const filename = `destin-flow-${type}-${getCurrentTimestamp().slice(0, 10)}.csv`;
  downloadTextFile(filename, csv, "text/csv;charset=utf-8");
  showToast("CSV descargado.");
}

function expenseToCsvRow(expense) {
  const method = findById(state.paymentMethods, expense.paymentMethodId);
  const owner = method ? findById(state.members, method.ownerId) : null;
  const member = expense.type === "familiar" ? findById(state.members, expense.memberId) : null;
  const business = expense.type === "negocio" ? findById(state.businesses, expense.businessId) : null;

  return [
    expense.type,
    expense.date,
    formatTime(expense.registeredAt),
    expense.amount,
    paymentStatusLabel(expense.paymentStatus),
    expense.category,
    member?.name || "",
    business?.name || "",
    method?.name || "",
    owner?.name || "",
    method?.shared ? "si" : "no",
    expense.description || "",
    expense.vendor || "",
    expense.responsible || ""
  ].map(csvValue).join(",");
}

function csvValue(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importBackup(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(reader.result);
      const importedData = parsed.data || parsed;
      validateImportedData(importedData);
      state = normalizeData(importedData);
      saveData();
      showAppOrOnboarding();
      if (state.userProfile) render();
      showToast("Copia JSON restaurada.");
    } catch (error) {
      showToast("No se pudo restaurar esa copia.");
    }
  });
  reader.readAsText(file);
}

function validateImportedData(data) {
  const requiredArrays = ["members", "paymentMethods", "businesses", "expenses"];
  if (!data || !data.familyGroup) throw new Error("Copia invalida");
  requiredArrays.forEach((key) => {
    if (!Array.isArray(data[key])) throw new Error("Copia incompleta");
  });
}

window.DestinFlowApp = window.DestinFlowApp || {};
window.DestinFlowApp.markCloudSynced = markCloudSynced;
window.DestinFlowApp.reloadLocalState = function reloadLocalState() {
  state = loadData();
  showAppOrOnboarding();
  if (state.userProfile) render();
};

setupNavigation();
setupForms();
setupActions();
setupFilters();
showAppOrOnboarding();
if (state.userProfile) {
  render();
  acceptInvitationFromHash();
}
window.addEventListener("hashchange", () => {
  if (state.userProfile) acceptInvitationFromHash();
});
