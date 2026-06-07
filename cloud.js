(function () {
  const config = window.DESTIN_FLOW_CLOUD || {};
  const storageRootKey = "destinFlowData";
  const sessionKey = "destinFlowSession";
  const pendingJoinKey = "destinFlowPendingJoinToken";
  const clientIdKey = "destinFlowRealtimeClientId";
  const cloudState = {
    client: null,
    user: null,
    realtimeChannel: null,
    autoPushTimer: null,
    applyingRemote: false
  };
  window.DestinFlowCloud = window.DestinFlowCloud || {};

  function isConfigured() {
    // Keeps the local MVP usable until real Supabase credentials are added.
    return Boolean(
      config.enabled &&
      config.supabaseUrl &&
      config.supabaseAnonKey &&
      !config.supabaseUrl.includes("YOUR_PROJECT_ID") &&
      !config.supabaseAnonKey.includes("YOUR_SUPABASE")
    );
  }

  function setCloudStatus(message) {
    const status = document.getElementById("cloud-status");
    if (!status) return;
    status.replaceChildren();
    const item = document.createElement("div");
    const text = document.createElement("span");
    item.className = "stack-item";
    text.textContent = message;
    item.appendChild(text);
    status.appendChild(item);
  }

  function getRealtimeClientId() {
    let clientId = sessionStorage.getItem(clientIdKey);
    if (!clientId) {
      clientId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem(clientIdKey, clientId);
    }
    return clientId;
  }

  function getCloudErrorMessage(error) {
    const message = error?.message || String(error || "");
    if (message.includes("public.cloud_groups")) {
      return "Falta crear la tabla cloud_groups. Ejecuta supabase-cloud-groups-migration.sql en Supabase SQL Editor y vuelve a cargar la app.";
    }
    if (message.includes("public.cloud_group_access")) {
      return "Falta crear la tabla cloud_group_access. Ejecuta supabase-cloud-groups-migration.sql en Supabase SQL Editor y vuelve a cargar la app.";
    }
    if (message.includes("public.cloud_expenses")) {
      return "Falta crear la tabla cloud_expenses. Ejecuta supabase-cloud-groups-migration.sql en Supabase SQL Editor y vuelve a cargar la app.";
    }
    if (message.includes("public.cloud_snapshots")) {
      return "Falta crear la tabla cloud_snapshots. Ejecuta supabase-cloud-groups-migration.sql en Supabase SQL Editor y vuelve a cargar la app.";
    }
    if (message.includes("join_token")) {
      return "Falta actualizar los links de grupo en Supabase. Ejecuta supabase-cloud-groups-migration.sql y recarga la app.";
    }
    if (message.includes("join_cloud_group_by_token")) {
      return "Falta crear la funcion para unirse por link. Ejecuta supabase-cloud-groups-migration.sql y recarga la app.";
    }
    return message;
  }

  function setCloudControlsEnabled(enabled) {
    [
      "cloud-upload",
      "cloud-download",
      "cloud-sign-out",
      "cloud-publish-group",
      "cloud-copy-join-link",
      "cloud-push-group",
      "cloud-pull-group",
      "cloud-load-groups"
    ].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.disabled = !enabled;
    });
    const inviteForm = document.getElementById("cloud-group-invite-form");
    if (inviteForm) {
      inviteForm.querySelectorAll("input, button").forEach((element) => {
        element.disabled = !enabled;
      });
    }
  }

  function togglePasswordAuth(visible) {
    const form = document.getElementById("cloud-auth-form");
    if (form) form.hidden = !visible;
  }

  async function initCloud() {
    // Starts Supabase auth only when cloud-config.js has been activated.
    if (!isConfigured()) {
      setCloudStatus("Nube no configurada. Edita cloud-config.js con tu URL y anon key de Supabase.");
      return;
    }
    if (!window.supabase) {
      setCloudStatus("No se pudo cargar Supabase JS. Revisa tu conexion a internet.");
      return;
    }

    cloudState.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data } = await cloudState.client.auth.getUser();
    cloudState.user = data.user || null;
    if (cloudState.user) await ensureProfile();
    renderCloudUser();
    if (cloudState.user) {
      await handleJoinLink();
      await loadSharedGroups();
      subscribeToRealtimeGroups();
    } else {
      await handleJoinLink();
    }

    cloudState.client.auth.onAuthStateChange(async (_event, session) => {
      cloudState.user = session?.user || null;
      if (cloudState.user) await ensureProfile();
      renderCloudUser();
      if (cloudState.user) {
        await handleJoinLink();
        await loadSharedGroups();
        subscribeToRealtimeGroups();
      } else {
        unsubscribeFromRealtimeGroups();
      }
    });
  }

  function renderCloudUser() {
    if (!cloudState.user) {
      setCloudStatus("Sin sesion en la nube.");
      setCloudControlsEnabled(false);
      setCloudConflictStatus(null);
      togglePasswordAuth(true);
      unsubscribeFromRealtimeGroups();
      return;
    }
    setCloudStatus(`Conectado a la nube como ${cloudState.user.email}.`);
    setCloudControlsEnabled(true);
    togglePasswordAuth(false);
    ensureLocalProfileFromCloud();
  }

  async function ensureProfile() {
    if (!cloudState.client || !cloudState.user) return;
    await cloudState.client
      .from("profiles")
      .upsert({
        id: cloudState.user.id,
        email: cloudState.user.email || "",
        display_name: cloudState.user.user_metadata?.full_name || cloudState.user.email || ""
      });
  }

  function getLocalPayload() {
    const raw = localStorage.getItem(getActiveLocalStorageKey());
    if (!raw) throw new Error("No hay datos locales para subir.");
    return JSON.parse(raw);
  }

  function saveLocalPayload(payload) {
    localStorage.setItem(getActiveLocalStorageKey(), JSON.stringify(payload));
  }

  function markPayloadSynced(payload, cloudTime = new Date().toISOString().slice(0, 19), groupId = "") {
    payload.sync = payload.sync || {};
    payload.sync.hasPendingChanges = false;
    payload.sync.lastCloudPushAt = cloudTime;
    payload.lastSavedAt = cloudTime;
    if (groupId && Array.isArray(payload.groups)) {
      const group = payload.groups.find((item) => item.id === groupId);
      if (group) group.cloudSyncedAt = cloudTime;
    }
    return payload;
  }

  function markLocalPayloadSynced(payload = null, groupId = "") {
    const cloudTime = new Date().toISOString().slice(0, 19);
    const targetPayload = payload || getLocalPayload();
    saveLocalPayload(markPayloadSynced(targetPayload, cloudTime, groupId));
    if (window.DestinFlowApp?.markCloudSynced) {
      window.DestinFlowApp.markCloudSynced(cloudTime);
    }
  }

  function parseTime(value) {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function getCloudConflict(payload, group, cloudGroup) {
    if (!group) return { level: "warning", message: "No hay grupo activo para comparar con la nube." };
    if (!cloudGroup?.payload) {
      return {
        level: payload.sync?.hasPendingChanges ? "warning" : "safe",
        message: "Este grupo aun no existe en la nube. Puedes publicarlo para compartirlo."
      };
    }

    const cloudTime = parseTime(cloudGroup.updated_at);
    const localSyncTime = parseTime(group.cloudSyncedAt || payload.sync?.lastCloudPushAt);
    const localChangedTime = parseTime(payload.sync?.lastLocalChangeAt || payload.lastSavedAt);
    const hasPendingLocal = Boolean(payload.sync?.hasPendingChanges);
    const cloudIsNewer = cloudTime > localSyncTime + 1000;

    if (cloudIsNewer && hasPendingLocal) {
      return {
        level: "danger",
        message: "Hay cambios en la nube y tambien cambios locales sin subir. Decide si quieres traer la nube o sobrescribirla con tus cambios."
      };
    }

    if (cloudIsNewer) {
      return {
        level: "warning",
        message: `La nube tiene una version mas reciente (${new Date(cloudGroup.updated_at).toLocaleString()}). Puedes traer esos cambios.`
      };
    }

    if (hasPendingLocal || localChangedTime > localSyncTime + 1000) {
      return {
        level: "warning",
        message: "Tienes cambios locales pendientes. Sube los cambios del grupo para compartirlos."
      };
    }

    return {
      level: "safe",
      message: "El grupo activo esta al dia con la nube."
    };
  }

  function setCloudConflictStatus(conflict) {
    const element = document.getElementById("cloud-conflict-status");
    if (!element) return;
    element.hidden = !conflict;
    element.className = `cloud-sync-status ${conflict?.level || ""}`;
    element.textContent = conflict?.message || "";
  }

  function getUserStorageKey(email) {
    return `${storageRootKey}:user:${String(email || "").trim().toLowerCase()}`;
  }

  function getActiveLocalStorageKey() {
    try {
      const session = JSON.parse(localStorage.getItem(sessionKey)) || null;
      return session?.email ? getUserStorageKey(session.email) : storageRootKey;
    } catch (error) {
      return storageRootKey;
    }
  }

  function setLocalSessionFromCloud() {
    if (!cloudState.user?.email) return;
    localStorage.setItem(sessionKey, JSON.stringify({
      email: String(cloudState.user.email).toLowerCase(),
      authProvider: "google",
      lastLoginAt: new Date().toISOString().slice(0, 19)
    }));
  }

  function ensureLocalProfileFromCloud() {
    if (!cloudState.user) return;
    const expectedKey = getUserStorageKey(cloudState.user.email);
    if (getActiveLocalStorageKey() !== expectedKey) {
      setLocalSessionFromCloud();
      window.setTimeout(() => window.location.reload(), 250);
      return;
    }
    const raw = localStorage.getItem(expectedKey);
    if (!raw) {
      window.setTimeout(() => window.location.reload(), 250);
      return;
    }

    try {
      const payload = JSON.parse(raw);
      if (payload.userProfile?.email === String(cloudState.user.email || "").toLowerCase()) return;
      payload.userProfile = {
        email: String(cloudState.user.email || "").toLowerCase(),
        usageMode: "both",
        createdAt: new Date().toISOString().slice(0, 19),
        authProvider: "google"
      };
      saveLocalPayload(payload);
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      setCloudStatus("No se pudo crear el perfil local desde Google.");
    }
  }

  function getActiveLocalGroup(payload) {
    const groups = Array.isArray(payload.groups) ? payload.groups : [];
    return groups.find((group) => group.id === payload.activeGroupId) || groups[0] || null;
  }

  function createJoinToken() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getJoinTokenFromUrl() {
    const hash = window.location.hash || "";
    const match = hash.match(/join=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function getJoinUrl(token) {
    return `${window.location.origin}${window.location.pathname}#join=${encodeURIComponent(token)}`;
  }

  function clearJoinHash() {
    if ((window.location.hash || "").includes("join=")) {
      window.history.replaceState(null, "", `${window.location.origin}${window.location.pathname}`);
    }
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    window.prompt("Copia este link:", text);
  }

  function parseTimeValue(value) {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function mergeExpenses(localExpenses = [], cloudExpenses = []) {
    const byId = new Map();
    localExpenses.forEach((expense) => {
      if (expense?.id) byId.set(expense.id, expense);
    });
    cloudExpenses.forEach((expense) => {
      if (!expense?.id) return;
      const existing = byId.get(expense.id);
      const incomingTime = parseTimeValue(expense.updatedAt || expense.registeredAt || expense.date);
      const existingTime = parseTimeValue(existing?.updatedAt || existing?.registeredAt || existing?.date);
      if (!existing || incomingTime >= existingTime) byId.set(expense.id, expense);
    });
    return Array.from(byId.values());
  }

  function mergeCloudGroupIntoLocal(payload, cloudGroup) {
    const group = cloudGroup.payload;
    if (!group?.id) throw new Error("El grupo cloud no tiene datos validos.");

    const userEmail = String(cloudState.user?.email || "").toLowerCase();
    group.members = Array.isArray(group.members) ? group.members : [];
    if (userEmail && !group.members.some((member) => String(member.email || "").toLowerCase() === userEmail)) {
      group.members.push({
        id: `member-cloud-${cloudState.user.id}`,
        name: userEmail.split("@")[0],
        email: userEmail,
        role: "miembro",
        color: "#146c72",
        status: "activo"
      });
    }

    payload.groups = Array.isArray(payload.groups) ? payload.groups : [];
    const existingIndex = payload.groups.findIndex((item) => item.id === group.id);
    if (existingIndex >= 0) {
      group.expenses = mergeExpenses(payload.groups[existingIndex].expenses, group.expenses);
      payload.groups[existingIndex] = group;
    }
    else payload.groups.push(group);
    payload.activeGroupId = group.id;
    return payload;
  }

  function setCloudGroupsList(items) {
    const list = document.getElementById("cloud-groups-list");
    if (!list) return;
    list.replaceChildren();

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No hay grupos compartidos para esta cuenta.";
      list.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const card = document.createElement("div");
      const title = document.createElement("strong");
      const meta = document.createElement("span");
      const button = document.createElement("button");
      const linkButton = document.createElement("button");

      card.className = "stack-item";
      title.textContent = item.name;
      meta.textContent = `Tipo: ${item.type || "otro"} | Actualizado: ${new Date(item.updated_at).toLocaleString()}`;
      button.className = "secondary-action";
      button.type = "button";
      button.textContent = "Traer este grupo";
      button.addEventListener("click", () => importCloudGroup(item.id));
      linkButton.className = "secondary-action";
      linkButton.type = "button";
      linkButton.textContent = "Copiar link";
      linkButton.addEventListener("click", async () => {
        if (!item.join_token) return setCloudStatus("Este grupo no tiene link. Publicalo otra vez.");
        await copyText(getJoinUrl(item.join_token));
        setCloudStatus("Link del grupo copiado.");
      });

      card.append(title, meta, button, linkButton);
      list.appendChild(card);
    });
  }

  function setCloudAccessList(items, cloudGroup) {
    const list = document.getElementById("cloud-access-list");
    if (!list) return;
    list.replaceChildren();

    if (!cloudGroup) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Publica el grupo activo para ver sus accesos cloud.";
      list.appendChild(empty);
      return;
    }

    const adminCard = document.createElement("div");
    const adminTitle = document.createElement("strong");
    const adminMeta = document.createElement("span");
    adminCard.className = "stack-item";
    adminTitle.textContent = cloudState.user?.id === cloudGroup.admin_user_id ? "Tu cuenta" : "Admin del grupo";
    adminMeta.textContent = "Rol: admin";
    adminCard.append(adminTitle, adminMeta);
    list.appendChild(adminCard);

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Aun no hay invitados cloud para este grupo.";
      list.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const card = document.createElement("div");
      const title = document.createElement("strong");
      const meta = document.createElement("span");
      const removeButton = document.createElement("button");

      card.className = "stack-item";
      title.textContent = item.email;
      meta.textContent = `Rol: ${item.role} | Estado: ${item.status}`;
      removeButton.className = "inline-danger";
      removeButton.type = "button";
      removeButton.textContent = "Quitar acceso";
      removeButton.addEventListener("click", () => removeCloudAccess(item.id, item.email));

      card.append(title, meta, removeButton);
      list.appendChild(card);
    });
  }

  function unsubscribeFromRealtimeGroups() {
    if (!cloudState.client || !cloudState.realtimeChannel) return;
    cloudState.client.removeChannel(cloudState.realtimeChannel);
    cloudState.realtimeChannel = null;
  }

  function subscribeToRealtimeGroups() {
    if (!cloudState.client || !cloudState.user) return;
    unsubscribeFromRealtimeGroups();
    cloudState.realtimeChannel = cloudState.client
      .channel(`destin-flow-groups-${cloudState.user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "cloud_groups"
      }, handleRealtimeCloudGroup)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "cloud_expenses"
      }, handleRealtimeExpense)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setCloudStatus(`Conectado a la nube como ${cloudState.user.email}. Sincronizacion en tiempo real activa.`);
        }
      });
  }

  function shouldApplyRealtimeGroup(cloudGroup) {
    if (!cloudGroup?.payload?.id) return false;
    if (cloudGroup.payload.cloudLastClientId === getRealtimeClientId()) return false;
    try {
      const payload = getLocalPayload();
      return Array.isArray(payload.groups) && payload.groups.some((group) => group.id === cloudGroup.payload.id);
    } catch (error) {
      return false;
    }
  }

  function applyRealtimeCloudGroup(cloudGroup) {
    if (!shouldApplyRealtimeGroup(cloudGroup)) return;
    try {
      cloudState.applyingRemote = true;
      const payload = markPayloadSynced(
        mergeCloudGroupIntoLocal(getLocalPayload(), cloudGroup),
        new Date().toISOString().slice(0, 19),
        cloudGroup.payload.id
      );
      saveLocalPayload(payload);
      setCloudStatus(`Cambios recibidos en tiempo real: ${cloudGroup.name || "grupo actualizado"}.`);
      window.setTimeout(() => window.location.reload(), 650);
    } catch (error) {
      setCloudStatus(error.message || "No se pudo aplicar el cambio recibido en tiempo real.");
    } finally {
      window.setTimeout(() => {
        cloudState.applyingRemote = false;
      }, 1000);
    }
  }

  function handleRealtimeCloudGroup(event) {
    const cloudGroup = event?.new;
    if (!cloudGroup?.payload) return;
    applyRealtimeCloudGroup(cloudGroup);
  }

  function applyRealtimeExpense(row, options = {}) {
    const shouldReload = options.reload !== false;
    const shouldAnnounce = options.announce !== false;
    if (!row?.local_group_id || !row?.local_expense_id) return;
    if (!options.force && row.payload?.cloudLastClientId === getRealtimeClientId()) return;
    try {
      cloudState.applyingRemote = true;
      const payload = getLocalPayload();
      const group = (payload.groups || []).find((item) => item.id === row.local_group_id);
      if (!group) return;
      group.expenses = Array.isArray(group.expenses) ? group.expenses : [];
      const index = group.expenses.findIndex((expense) => expense.id === row.local_expense_id);
      if (row.deleted) {
        if (index >= 0) group.expenses.splice(index, 1);
      } else if (row.payload) {
        const incomingExpense = { ...row.payload };
        delete incomingExpense.cloudLastClientId;
        delete incomingExpense.cloudLastUpdatedBy;
        if (index >= 0) group.expenses[index] = incomingExpense;
        else group.expenses.push(incomingExpense);
      }
      saveLocalPayload(markPayloadSynced(payload, new Date().toISOString().slice(0, 19), group.id));
      if (shouldAnnounce) setCloudStatus(row.deleted ? "Gasto eliminado recibido en tiempo real." : "Gasto recibido en tiempo real.");
      if (shouldReload) window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setCloudStatus(error.message || "No se pudo aplicar el gasto recibido en tiempo real.");
    } finally {
      window.setTimeout(() => {
        cloudState.applyingRemote = false;
      }, 1000);
    }
  }

  function handleRealtimeExpense(event) {
    const row = event?.new;
    if (!row) return;
    applyRealtimeExpense(row);
  }

  async function loadExpenseRowsForActiveGroup() {
    if (!cloudState.client || !cloudState.user) return;
    try {
      const { cloudGroup } = await findCloudGroupForActiveLocalGroup();
      if (!cloudGroup?.id) return;
      const { data, error } = await cloudState.client
        .from("cloud_expenses")
        .select("cloud_group_id, local_group_id, local_expense_id, payload, deleted, updated_at")
        .eq("cloud_group_id", cloudGroup.id)
        .order("updated_at", { ascending: true });
      if (error) throw error;
      let changed = false;
      (data || []).forEach((row) => {
        applyRealtimeExpense(row, { reload: false, announce: false, force: true });
        changed = true;
      });
      if (changed && window.DestinFlowApp?.reloadLocalState) {
        window.DestinFlowApp.reloadLocalState();
      }
    } catch (error) {
      setCloudStatus(getCloudErrorMessage(error) || "No se pudieron cargar gastos sincronizados por registro.");
    }
  }

  async function findCloudGroupForActiveLocalGroup() {
    const payload = getLocalPayload();
    const group = getActiveLocalGroup(payload);
    if (!group) throw new Error("No hay grupo activo.");

    const { data, error } = await cloudState.client
      .from("cloud_groups")
      .select("id, local_group_id, name, type, admin_user_id, payload, join_token, updated_at")
      .order("updated_at", { ascending: false });

    if (error) throw error;
    const cloudGroup = (data || []).find((item) => item.payload?.id === group.id || item.local_group_id === group.id);
    return { payload, group, cloudGroup };
  }

  async function refreshActiveGroupCloudStatus() {
    if (!cloudState.client || !cloudState.user) {
      setCloudConflictStatus(null);
      return;
    }

    try {
      const { payload, group, cloudGroup } = await findCloudGroupForActiveLocalGroup();
      setCloudConflictStatus(getCloudConflict(payload, group, cloudGroup));
    } catch (error) {
      setCloudConflictStatus({
        level: "warning",
        message: getCloudErrorMessage(error) || "No se pudo comparar el grupo activo con la nube."
      });
    }
  }

  async function uploadLocalSnapshot() {
    // Snapshot sync keeps the MVP reliable before adding row-by-row collaboration.
    if (!cloudState.client || !cloudState.user) return setCloudStatus("Inicia sesion cloud antes de subir datos.");

    try {
      await ensureProfile();
      const cloudTime = new Date().toISOString().slice(0, 19);
      const payload = markPayloadSynced(getLocalPayload(), cloudTime);
      const { error } = await cloudState.client
        .from("cloud_snapshots")
        .upsert({
          user_id: cloudState.user.id,
          payload,
          updated_at: new Date().toISOString()
        });

      if (!error) markLocalPayloadSynced(payload);
      setCloudStatus(error ? getCloudErrorMessage(error) : "Datos locales subidos a la nube.");
    } catch (error) {
      setCloudStatus(getCloudErrorMessage(error) || "No se pudieron subir los datos.");
    }
  }

  async function publishActiveGroup() {
    if (!cloudState.client || !cloudState.user) return setCloudStatus("Inicia sesion cloud antes de publicar un grupo.");

    try {
      await ensureProfile();
      const payload = getLocalPayload();
      const group = getActiveLocalGroup(payload);
      if (!group) throw new Error("No hay grupo activo para publicar.");
      group.cloudJoinToken = group.cloudJoinToken || createJoinToken();
      group.members = Array.isArray(group.members) ? group.members : [];
      const adminMember = group.members.find((member) => member.id === group.adminMemberId);
      if (adminMember && !adminMember.email) adminMember.email = cloudState.user.email || "";
      saveLocalPayload(payload);

      const { error } = await cloudState.client
        .from("cloud_groups")
        .upsert({
          local_group_id: group.id,
          name: group.name || group.familyGroup?.name || "Grupo sin nombre",
          type: group.type || "otro",
          admin_user_id: cloudState.user.id,
          payload: {
            ...group,
            cloudLastClientId: getRealtimeClientId(),
            cloudLastUpdatedBy: cloudState.user.email || ""
          },
          join_token: group.cloudJoinToken,
          updated_at: new Date().toISOString()
        }, { onConflict: "admin_user_id,local_group_id" });

      if (!error) {
        markLocalPayloadSynced(payload, group.id);
        await pushActiveExpenseRows();
        setCloudStatus("Grupo activo publicado en la nube.");
        await loadSharedGroups();
        await loadActiveGroupAccess();
        await refreshActiveGroupCloudStatus();
        return;
      }
      setCloudStatus(getCloudErrorMessage(error));
    } catch (error) {
      setCloudStatus(getCloudErrorMessage(error) || "No se pudo publicar el grupo.");
    }
  }

  async function copyActiveGroupJoinLink() {
    if (!cloudState.client || !cloudState.user) return setCloudStatus("Inicia sesion cloud antes de copiar el link.");

    try {
      await publishActiveGroup();
      const payload = getLocalPayload();
      const group = getActiveLocalGroup(payload);
      if (!group?.cloudJoinToken) throw new Error("No se pudo generar el link del grupo.");
      await copyText(getJoinUrl(group.cloudJoinToken));
      setCloudStatus("Link para unirse al grupo copiado.");
    } catch (error) {
      setCloudStatus(getCloudErrorMessage(error) || "No se pudo copiar el link del grupo.");
    }
  }

  async function joinGroupByToken(token) {
    if (!cloudState.client || !cloudState.user) {
      localStorage.setItem(pendingJoinKey, token);
      setCloudStatus("Para unirte al grupo, inicia sesion con Google.");
      return;
    }

    try {
      await ensureProfile();
      const { data, error } = await cloudState.client.rpc("join_cloud_group_by_token", {
        target_join_token: token
      });
      if (error) throw error;
      const cloudGroup = Array.isArray(data) ? data[0] : data;
      if (!cloudGroup?.payload) throw new Error("No se encontro un grupo con ese link.");

      const payload = mergeCloudGroupIntoLocal(getLocalPayload(), cloudGroup);
      saveLocalPayload(markPayloadSynced(payload, new Date().toISOString().slice(0, 19), cloudGroup.payload.id));
      localStorage.removeItem(pendingJoinKey);
      clearJoinHash();
      setCloudStatus("Te uniste al grupo. La app se actualizara ahora.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setCloudStatus(getCloudErrorMessage(error) || "No se pudo unir al grupo con este link.");
    }
  }

  async function handleJoinLink() {
    const urlToken = getJoinTokenFromUrl();
    if (urlToken) localStorage.setItem(pendingJoinKey, urlToken);
    const token = urlToken || localStorage.getItem(pendingJoinKey);
    if (!token) return;
    await joinGroupByToken(token);
  }

  async function inviteToActiveCloudGroup(email) {
    if (!cloudState.client || !cloudState.user) return setCloudStatus("Inicia sesion cloud antes de invitar.");

    try {
      await publishActiveGroup();
      const payload = getLocalPayload();
      const group = getActiveLocalGroup(payload);
      const normalizedEmail = String(email || "").trim().toLowerCase();
      if (!normalizedEmail) throw new Error("Escribe un correo para invitar.");

      const { data: cloudGroup, error: groupError } = await cloudState.client
        .from("cloud_groups")
        .select("id")
        .eq("admin_user_id", cloudState.user.id)
        .eq("local_group_id", group.id)
        .maybeSingle();
      if (groupError) throw groupError;
      if (!cloudGroup?.id) throw new Error("Publica el grupo antes de invitar.");

      const { error } = await cloudState.client
        .from("cloud_group_access")
        .upsert({
          cloud_group_id: cloudGroup.id,
          email: normalizedEmail,
          role: "miembro",
          status: "activo"
        }, { onConflict: "cloud_group_id,email" });

      setCloudStatus(error ? getCloudErrorMessage(error) : `Invitacion cloud creada para ${normalizedEmail}.`);
      if (!error) await loadActiveGroupAccess();
    } catch (error) {
      setCloudStatus(getCloudErrorMessage(error) || "No se pudo crear la invitacion cloud.");
    }
  }

  async function loadSharedGroups() {
    if (!cloudState.client || !cloudState.user) return setCloudStatus("Inicia sesion cloud para ver grupos compartidos.");

    const { data, error } = await cloudState.client
      .from("cloud_groups")
      .select("id, local_group_id, name, type, payload, join_token, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      setCloudStatus(getCloudErrorMessage(error));
      return;
    }

    setCloudGroupsList(data || []);
    setCloudStatus(`${(data || []).length} grupo(s) cloud disponibles.`);
    await loadActiveGroupAccess();
    await loadExpenseRowsForActiveGroup();
    await refreshActiveGroupCloudStatus();
  }

  async function loadActiveGroupAccess() {
    if (!cloudState.client || !cloudState.user) return;

    try {
      const { cloudGroup } = await findCloudGroupForActiveLocalGroup();
      if (!cloudGroup?.id) {
        setCloudAccessList([], null);
        return;
      }

      const { data, error } = await cloudState.client
        .from("cloud_group_access")
        .select("id, email, role, status, created_at")
        .eq("cloud_group_id", cloudGroup.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setCloudAccessList(data || [], cloudGroup);
    } catch (error) {
      setCloudStatus(getCloudErrorMessage(error) || "No se pudieron cargar los accesos cloud.");
    }
  }

  async function removeCloudAccess(accessId, email) {
    if (!cloudState.client || !cloudState.user) return setCloudStatus("Inicia sesion cloud antes de quitar accesos.");
    if (!window.confirm(`Quitar acceso cloud a ${email}?`)) return;

    const { error } = await cloudState.client
      .from("cloud_group_access")
      .delete()
      .eq("id", accessId);

    if (error) return setCloudStatus(getCloudErrorMessage(error));
    setCloudStatus(`Acceso cloud removido para ${email}.`);
    await loadActiveGroupAccess();
    await loadSharedGroups();
  }

  function scheduleRealtimePush() {
    if (!cloudState.client || !cloudState.user || cloudState.applyingRemote) return;
    window.clearTimeout(cloudState.autoPushTimer);
    cloudState.autoPushTimer = window.setTimeout(() => {
      pushActiveExpenseRows().then(() => pushActiveGroupChanges({ automatic: true }));
    }, 1400);
  }

  async function pushActiveExpenseRows() {
    if (!cloudState.client || !cloudState.user) return;
    try {
      const { group, cloudGroup } = await findCloudGroupForActiveLocalGroup();
      if (!cloudGroup?.id) return;
      const rows = (group.expenses || []).map((expense) => ({
        cloud_group_id: cloudGroup.id,
        local_group_id: group.id,
        local_expense_id: expense.id,
        payload: {
          ...expense,
          cloudLastClientId: getRealtimeClientId(),
          cloudLastUpdatedBy: cloudState.user.email || ""
        },
        deleted: false,
        updated_by: cloudState.user.id,
        updated_at: new Date().toISOString()
      }));
      if (!rows.length) return;
      const { error } = await cloudState.client
        .from("cloud_expenses")
        .upsert(rows, { onConflict: "cloud_group_id,local_expense_id" });
      if (error) setCloudStatus(getCloudErrorMessage(error));
    } catch (error) {
      setCloudStatus(getCloudErrorMessage(error) || "No se pudieron sincronizar los gastos por registro.");
    }
  }

  async function pushDeletedExpenseRow(expense, localGroupId) {
    if (!cloudState.client || !cloudState.user || !expense?.id) return;
    try {
      const { cloudGroup } = await findCloudGroupForActiveLocalGroup();
      if (!cloudGroup?.id) return;
      const { error } = await cloudState.client
        .from("cloud_expenses")
        .upsert({
          cloud_group_id: cloudGroup.id,
          local_group_id: localGroupId,
          local_expense_id: expense.id,
          payload: {
            ...expense,
            cloudLastClientId: getRealtimeClientId(),
            cloudLastUpdatedBy: cloudState.user.email || ""
          },
          deleted: true,
          updated_by: cloudState.user.id,
          updated_at: new Date().toISOString()
        }, { onConflict: "cloud_group_id,local_expense_id" });
      if (error) setCloudStatus(getCloudErrorMessage(error));
    } catch (error) {
      setCloudStatus(getCloudErrorMessage(error) || "No se pudo sincronizar la eliminacion del gasto.");
    }
  }

  async function pushActiveGroupChanges(options = {}) {
    if (!cloudState.client || !cloudState.user) return setCloudStatus("Inicia sesion cloud antes de subir cambios.");

    try {
      const { payload, group, cloudGroup } = await findCloudGroupForActiveLocalGroup();
      if (!cloudGroup?.id) {
        if (!options.automatic) await publishActiveGroup();
        return;
      }

      const conflict = getCloudConflict(payload, group, cloudGroup);
      if (conflict.level === "danger") {
        if (options.automatic) {
          setCloudConflictStatus(conflict);
          return setCloudStatus("Hay cambios locales y cambios en la nube. Revisa antes de sobrescribir.");
        }
        const confirmed = window.confirm("La nube tiene cambios mas recientes y tambien tienes cambios locales. Si subes ahora, puedes sobrescribir cambios de otra persona. Continuar?");
        if (!confirmed) {
          setCloudConflictStatus(conflict);
          return setCloudStatus("Subida cancelada para evitar sobrescribir cambios.");
        }
      }

      const { error } = await cloudState.client
        .from("cloud_groups")
        .update({
          name: group.name || group.familyGroup?.name || "Grupo sin nombre",
          type: group.type || "otro",
          payload: {
            ...group,
            cloudLastClientId: getRealtimeClientId(),
            cloudLastUpdatedBy: cloudState.user.email || ""
          },
          join_token: group.cloudJoinToken || cloudGroup.join_token || createJoinToken(),
          updated_at: new Date().toISOString()
        })
        .eq("id", cloudGroup.id);

      if (error) return setCloudStatus(getCloudErrorMessage(error));
      await pushActiveExpenseRows();
      markLocalPayloadSynced(payload, group.id);
      setCloudStatus(options.automatic ? "Cambio sincronizado en tiempo real." : "Cambios del grupo subidos a la nube.");
      if (!options.automatic) await loadSharedGroups();
    } catch (error) {
      setCloudStatus(getCloudErrorMessage(error) || "No se pudieron subir los cambios del grupo.");
    }
  }

  async function pullActiveGroupChanges() {
    if (!cloudState.client || !cloudState.user) return setCloudStatus("Inicia sesion cloud antes de traer cambios.");

    try {
      const { payload, group, cloudGroup } = await findCloudGroupForActiveLocalGroup();
      if (!cloudGroup?.payload) {
        setCloudStatus("Este grupo aun no existe en la nube. Publicalo primero.");
        return;
      }

      const conflict = getCloudConflict(payload, group, cloudGroup);
      const message = conflict.level === "danger"
        ? "Tienes cambios locales sin subir y la nube tambien cambio. Traer la nube reemplazara tu version local del grupo activo. Continuar?"
        : "Traer cambios reemplazara la version local del grupo activo. Continuar?";
      const confirmed = window.confirm(message);
      if (!confirmed) return;

      saveLocalPayload(markPayloadSynced(mergeCloudGroupIntoLocal(payload, cloudGroup), new Date().toISOString().slice(0, 19), cloudGroup.payload.id));
      setCloudStatus("Cambios del grupo traidos desde la nube.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setCloudStatus(getCloudErrorMessage(error) || "No se pudieron traer los cambios del grupo.");
    }
  }

  async function importCloudGroup(cloudGroupId) {
    if (!cloudState.client || !cloudState.user) return setCloudStatus("Inicia sesion cloud antes de traer un grupo.");
    const confirmed = window.confirm("Traer este grupo lo agregara o actualizara en este navegador. Continuar?");
    if (!confirmed) return;

    const { data, error } = await cloudState.client
      .from("cloud_groups")
      .select("id, payload")
      .eq("id", cloudGroupId)
      .maybeSingle();

    if (error) return setCloudStatus(getCloudErrorMessage(error));
    if (!data?.payload) return setCloudStatus("No se encontro el grupo cloud.");

    try {
      const payload = markPayloadSynced(mergeCloudGroupIntoLocal(getLocalPayload(), data), new Date().toISOString().slice(0, 19), data.payload.id);
      saveLocalPayload(payload);
      setCloudStatus("Grupo cloud agregado a tus datos locales.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setCloudStatus(error.message || "No se pudo traer el grupo.");
    }
  }

  async function downloadCloudSnapshot() {
    if (!cloudState.client || !cloudState.user) return setCloudStatus("Inicia sesion cloud antes de restaurar datos.");
    const confirmed = window.confirm("Restaurar desde la nube reemplazara los datos locales de este navegador. Continuar?");
    if (!confirmed) return;

    const { data, error } = await cloudState.client
      .from("cloud_snapshots")
      .select("payload, updated_at")
      .eq("user_id", cloudState.user.id)
      .maybeSingle();

    if (error) return setCloudStatus(error.message);
    if (!data?.payload) return setCloudStatus("Todavia no hay una copia en la nube para esta cuenta.");

    saveLocalPayload(markPayloadSynced(data.payload));
    setCloudStatus(`Datos restaurados desde la nube. Ultima copia: ${new Date(data.updated_at).toLocaleString()}.`);
    window.setTimeout(() => window.location.reload(), 700);
  }

  async function signUp(email, password) {
    // Creates the user in Supabase Auth. Data sync is added in the next cloud phase.
    if (!cloudState.client) return setCloudStatus("Configura Supabase antes de registrarte.");
    const { error } = await cloudState.client.auth.signUp({ email, password });
    setCloudStatus(error ? error.message : "Registro enviado. Revisa tu correo si Supabase pide confirmacion.");
  }

  async function signIn(email, password) {
    // Opens a Supabase session so the app can later sync group data by user.
    if (!cloudState.client) return setCloudStatus("Configura Supabase antes de iniciar sesion.");
    const { error } = await cloudState.client.auth.signInWithPassword({ email, password });
    setCloudStatus(error ? error.message : "Sesion iniciada.");
  }

  async function signInWithGoogle() {
    // Google OAuth needs an HTTP/HTTPS return URL configured in Supabase Auth.
    if (!cloudState.client) return setCloudStatus("Configura Supabase antes de usar Google.");
    if (window.location.protocol === "file:") {
      setCloudStatus("Google requiere abrir la app desde http://localhost o una URL publicada, no desde archivo local.");
      return;
    }

    const redirectTo = window.location.href.split("#")[0];
    const joinToken = getJoinTokenFromUrl();
    if (joinToken) localStorage.setItem(pendingJoinKey, joinToken);
    const { error } = await cloudState.client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    if (error) setCloudStatus(error.message);
  }

  async function signOut() {
    if (!cloudState.client) return;
    await cloudState.client.auth.signOut();
    setCloudStatus("Sesion cerrada.");
  }

  window.DestinFlowCloud.signOut = signOut;

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("cloud-auth-form");
    const googleButton = document.getElementById("cloud-google-sign-in");
    const onboardingGoogleButton = document.getElementById("onboarding-google-sign-in");
    const uploadButton = document.getElementById("cloud-upload");
    const downloadButton = document.getElementById("cloud-download");
    const publishGroupButton = document.getElementById("cloud-publish-group");
    const copyJoinLinkButton = document.getElementById("cloud-copy-join-link");
    const pushGroupButton = document.getElementById("cloud-push-group");
    const pullGroupButton = document.getElementById("cloud-pull-group");
    const loadGroupsButton = document.getElementById("cloud-load-groups");
    const inviteGroupForm = document.getElementById("cloud-group-invite-form");
    const signOutButton = document.getElementById("cloud-sign-out");

    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const action = data.get("cloudAction");
        const email = String(data.get("cloudEmail") || "").trim();
        const password = String(data.get("cloudPassword") || "");
        if (action === "signup") await signUp(email, password);
        if (action === "signin") await signIn(email, password);
      });
    }

    if (googleButton) {
      googleButton.addEventListener("click", signInWithGoogle);
    }

    if (onboardingGoogleButton) {
      onboardingGoogleButton.addEventListener("click", signInWithGoogle);
    }

    if (uploadButton) {
      uploadButton.addEventListener("click", uploadLocalSnapshot);
    }

    if (downloadButton) {
      downloadButton.addEventListener("click", downloadCloudSnapshot);
    }

    if (publishGroupButton) {
      publishGroupButton.addEventListener("click", publishActiveGroup);
    }

    if (copyJoinLinkButton) {
      copyJoinLinkButton.addEventListener("click", copyActiveGroupJoinLink);
    }

    if (pushGroupButton) {
      pushGroupButton.addEventListener("click", () => pushActiveGroupChanges());
    }

    if (pullGroupButton) {
      pullGroupButton.addEventListener("click", pullActiveGroupChanges);
    }

    if (loadGroupsButton) {
      loadGroupsButton.addEventListener("click", loadSharedGroups);
    }

    if (inviteGroupForm) {
      inviteGroupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(inviteGroupForm);
        await inviteToActiveCloudGroup(data.get("cloudInviteEmail"));
        inviteGroupForm.reset();
      });
    }

    if (signOutButton) {
      signOutButton.addEventListener("click", signOut);
    }

    const groupSelect = document.getElementById("active-group-select");
    if (groupSelect) {
      groupSelect.addEventListener("change", () => {
        window.setTimeout(refreshActiveGroupCloudStatus, 150);
        window.setTimeout(subscribeToRealtimeGroups, 250);
      });
    }

    window.addEventListener("destin-flow:local-save", scheduleRealtimePush);
    window.addEventListener("destin-flow:expense-delete", (event) => {
      if (cloudState.applyingRemote) return;
      pushDeletedExpenseRow(event.detail?.expense, event.detail?.activeGroupId);
    });

    initCloud();
  });
})();
