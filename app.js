const firebaseConfig = {
  apiKey: "AIzaSyCztg0OrUbKKQazOJGcGHtrx8dAokCk29w",
  authDomain: "discord-rip-off-41633.firebaseapp.com",
  projectId: "discord-rip-off-41633",
  storageBucket: "discord-rip-off-41633.firebasestorage.app",
  messagingSenderId: "892829121681",
  appId: "1:892829121681:web:7ad12db893aabfde595330",
  measurementId: "G-9TF5S4YVH8"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const authOverlay = document.getElementById("authOverlay");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const loginError = document.getElementById("loginError");
const registerError = document.getElementById("registerError");
const accountName = document.getElementById("accountName");
const accountStatus = document.getElementById("accountStatus");
const signOutBtn = document.getElementById("signOutBtn");
const chatWindow = document.getElementById("chatWindow");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const onlineCount = document.getElementById("onlineCount");
const friendsList = document.getElementById("friendsList");
const activeChannelLabel = document.getElementById("activeChannel");
const messageCount = document.getElementById("messageCount");
const startVoiceBtn = document.getElementById("startVoiceBtn");
const leaveVoiceBtn = document.getElementById("leaveVoiceBtn");
const voiceStatus = document.getElementById("voiceStatus");
const voiceBadge = document.getElementById("voiceBadge");
const voiceParticipants = document.getElementById("voiceParticipants");
const voiceRoomName = document.getElementById("voiceRoomName");
const voiceCount = document.getElementById("voiceCount");
const friendHandleInput = document.getElementById("friendHandleInput");
const addFriendBtn = document.getElementById("addFriendBtn");
const friendsError = document.getElementById("friendsError");
const dmList = document.getElementById("dmList");

let currentChannelId = "general";
let currentChannelType = "channel";
let currentChannelLabel = "messages";

let currentChannel = "general";
let currentVoiceRoom = "daily-sync";
let currentUser = null;
let unsubscribeMessages = null;
let unsubscribePresence = null;
let unsubscribeVoice = null;
let unsubscribeFriends = null;
let localStream = null;
let peerConnections = {};
const remoteAudioElements = new Set();
let localStream = null;
let peerConnections = {};

function setActiveTab(tab){
  if(tab === "login"){
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    loginTab.classList.remove("ghost");
    registerTab.classList.add("ghost");
  } else {
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    registerTab.classList.remove("ghost");
    loginTab.classList.add("ghost");
  }
  loginError.textContent = "";
  registerError.textContent = "";
}

loginTab.addEventListener("click", () => setActiveTab("login"));
registerTab.addEventListener("click", () => setActiveTab("register"));

loginBtn.addEventListener("click", async () => {
  loginError.textContent = "";
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPass").value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    loginError.textContent = formatAuthError(error);
    loginError.textContent = error.message;
  }
});

registerBtn.addEventListener("click", async () => {
  registerError.textContent = "";
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPass").value;
  const handle = document.getElementById("registerHandle").value.trim();
  const status = document.getElementById("registerStatus").value.trim() || "Working";
  if(!handle){
    registerError.textContent = "Please enter a display name.";
    return;
  }
  try {
    const credential = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection("users").doc(credential.user.uid).set({
      handle,
      status,
      email,
      online: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    registerError.textContent = formatAuthError(error);
    registerError.textContent = error.message;
  }
});

signOutBtn.addEventListener("click", async () => {
  if(currentUser){
    await db.collection("users").doc(currentUser.uid).set({
      online: false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
  await auth.signOut();
});

function renderMessage(messageId, data){
  const wrapper = document.createElement("div");
  wrapper.className = "message";
  const canDelete = currentUser && data.uid === currentUser.uid;
  wrapper.innerHTML = `
    <div class="avatar">${(data.handle || "?").slice(0,2).toUpperCase()}</div>
    <div>
      <div class="meta">
        <span class="name">${data.handle || "Unknown"}</span>
        <span class="time">${data.createdAt ? data.createdAt.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : ""}</span>
        ${canDelete ? `<button class="message-action" data-message-id="${messageId}" title="Delete message">Delete</button>` : ""}
      </div>
function renderMessage(data){
  const wrapper = document.createElement("div");
  wrapper.className = "message";
  wrapper.innerHTML = `
    <div class="avatar">${(data.handle || "?").slice(0,2).toUpperCase()}</div>
    <div>
      <div class="meta"><span class="name">${data.handle || "Unknown"}</span><span class="time">${data.createdAt ? data.createdAt.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : ""}</span></div>
      <p class="text">${data.text}</p>
    </div>
  `;
  chatWindow.appendChild(wrapper);
}

function subscribeToMessages(){
  if(unsubscribeMessages){
    unsubscribeMessages();
  }
  chatWindow.innerHTML = "";
  unsubscribeMessages = getMessageCollection()
  unsubscribeMessages = db.collection("channels").doc(currentChannel).collection("messages")
    .orderBy("createdAt", "asc")
    .limitToLast(50)
    .onSnapshot(snapshot => {
      chatWindow.innerHTML = "";
      snapshot.forEach(doc => renderMessage(doc.id, doc.data()));
      snapshot.forEach(doc => renderMessage(doc.data()));
      chatWindow.scrollTop = chatWindow.scrollHeight;
      messageCount.textContent = snapshot.size;
    });
}

async function sendMessage(){
  const text = messageInput.value.trim();
  if(!text || !currentUser){
    return;
  }
  const userDoc = await db.collection("users").doc(currentUser.uid).get();
  const userData = userDoc.data();
  await getMessageCollection().add({
  await db.collection("channels").doc(currentChannel).collection("messages").add({
    text,
    handle: userData?.handle || currentUser.email,
    uid: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  messageInput.value = "";
}

function getMessageCollection(){
  if(currentChannelType === "dm"){
    return db.collection("dms").doc(currentChannelId).collection("messages");
  }
  return db.collection("channels").doc(currentChannelId).collection("messages");
}

sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", (event) => {
  if(event.key === "Enter"){
    sendMessage();
  }
});

chatWindow.addEventListener("click", (event) => {
  const button = event.target.closest(".message-action");
  if(!button){
    return;
  }
  const messageId = button.dataset.messageId;
  if(messageId){
    getMessageCollection().doc(messageId).delete();
  }
});

addFriendBtn.addEventListener("click", addFriendByHandle);
friendHandleInput.addEventListener("keydown", (event) => {
  if(event.key === "Enter"){
    addFriendByHandle();
  }
});

function subscribeToPresence(){
  if(unsubscribePresence){
    unsubscribePresence();
  }
  unsubscribePresence = db.collection("users").where("online", "==", true)
    .onSnapshot(snapshot => {
      friendsList.innerHTML = "";
      snapshot.forEach(doc => {
        const data = doc.data();
        const row = document.createElement("div");
        row.className = "friend";
        row.innerHTML = `
          <div class="avatar">${(data.handle || "?").slice(0,2).toUpperCase()}</div>
          <div>
            <div>${data.handle || "Unknown"}</div>
            <small>${data.status || "Online"}</small>
          </div>
        `;
        friendsList.appendChild(row);
      });
      onlineCount.textContent = `Online ${snapshot.size}`;
    });
}

function subscribeToFriends(){
  if(!currentUser){
    return;
  }
  if(unsubscribeFriends){
    unsubscribeFriends();
  }
  unsubscribeFriends = db.collection("users").doc(currentUser.uid).collection("friends")
    .onSnapshot(snapshot => {
      dmList.innerHTML = "";
      snapshot.forEach(doc => {
        const data = doc.data();
        const dmItem = document.createElement("button");
        dmItem.className = "dm-item";
        dmItem.type = "button";
        dmItem.innerHTML = `
          <span class="dm-name">${data.handle || data.email || "Unknown"}</span>
          <span class="dm-meta">${data.status || "Offline"}</span>
          <span class="dm-actions">
            <button class="dm-call" type="button">Call</button>
          </span>
        `;
        dmItem.addEventListener("click", (event) => {
          if(event.target.closest(".dm-call")){
            callFriend(doc.id, data.handle || data.email || "DM");
            return;
          }
          setDmChannel(doc.id, data.handle || data.email || "DM");
        });
        dmList.appendChild(dmItem);
      });
    });
}

function buildDmId(uidA, uidB){
  return [uidA, uidB].sort().join("-");
}

function setDmChannel(friendUid, label){
  if(!currentUser){
    return;
  }
  currentChannelId = buildDmId(currentUser.uid, friendUid);
  currentChannelType = "dm";
  currentChannelLabel = label;
  activeChannelLabel.textContent = `@ ${label}`;
  messageInput.placeholder = `Message @${label}`;
  document.querySelectorAll(".channel").forEach(channel => channel.classList.remove("active"));
  subscribeToMessages();
}

function callFriend(friendUid, label){
  if(!currentUser){
    return;
  }
  const dmRoom = `dm-${buildDmId(currentUser.uid, friendUid)}`;
  setVoiceRoom(dmRoom);
  voiceRoomName.textContent = `Call with ${label}`;
  joinVoice();
}

async function addFriendByHandle(){
  if(!currentUser){
    return;
  }
  const handle = friendHandleInput.value.trim();
  if(!handle){
    friendsError.textContent = "Enter a handle to add.";
    return;
  }
  friendsError.textContent = "";
  const snapshot = await db.collection("users").where("handle", "==", handle).limit(1).get();
  if(snapshot.empty){
    friendsError.textContent = "No user found with that handle.";
    return;
  }
  const friendDoc = snapshot.docs[0];
  if(friendDoc.id === currentUser.uid){
    friendsError.textContent = "You cannot add yourself.";
    return;
  }
  const friendData = friendDoc.data();
  const currentUserDoc = await db.collection("users").doc(currentUser.uid).get();
  const currentData = currentUserDoc.data() || {};

  await db.collection("users").doc(currentUser.uid).collection("friends").doc(friendDoc.id).set({
    handle: friendData.handle || handle,
    email: friendData.email || "",
    status: friendData.status || "Offline"
  }, { merge: true });

  await db.collection("users").doc(friendDoc.id).collection("friends").doc(currentUser.uid).set({
    handle: currentData.handle || currentUser.email,
    email: currentData.email || currentUser.email,
    status: currentData.status || "Online"
  }, { merge: true });

  friendHandleInput.value = "";
}

function setChannel(name, label = name){
  currentChannelId = name;
  currentChannelType = "channel";
  currentChannelLabel = label;
  activeChannelLabel.textContent = `# ${label}`;
  messageInput.placeholder = `Message #${label}`;
function setChannel(name){
  currentChannel = name;
  activeChannelLabel.textContent = `# ${name}`;
  messageInput.placeholder = `Message #${name}`;
  document.querySelectorAll(".channel").forEach(channel => channel.classList.remove("active"));
  document.querySelectorAll(`[data-channel="${name}"]`).forEach(channel => channel.classList.add("active"));
  subscribeToMessages();
}

document.querySelectorAll("[data-channel]").forEach(channel => {
  channel.addEventListener("click", () => {
    setChannel(channel.dataset.channel);
  });
});

function setVoiceRoom(name){
  currentVoiceRoom = name;
  voiceRoomName.textContent = name;
  document.querySelectorAll("[data-voice]").forEach(channel => channel.classList.remove("active"));
  document.querySelectorAll(`[data-voice="${name}"]`).forEach(channel => channel.classList.add("active"));
  subscribeToVoiceRoom();
}

document.querySelectorAll("[data-voice]").forEach(channel => {
  channel.addEventListener("click", () => {
    setVoiceRoom(channel.dataset.voice);
  });
});

async function subscribeToVoiceRoom(){
  if(unsubscribeVoice){
    unsubscribeVoice();
  }
  unsubscribeVoice = db.collection("voiceRooms").doc(currentVoiceRoom).collection("participants")
    .onSnapshot(snapshot => {
      voiceParticipants.textContent = `${snapshot.size} listeners`;
      voiceCount.textContent = `${snapshot.size} live`;
    });
}

async function joinVoice(){
  if(!currentUser){
    return;
  }
  voiceStatus.textContent = "Connecting...";
  voiceBadge.textContent = "Live";
  voiceBadge.classList.remove("offline");
  voiceBadge.classList.add("live");
  await db.collection("voiceRooms").doc(currentVoiceRoom).collection("participants").doc(currentUser.uid).set({
    joinedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  const roomRef = db.collection("voiceRooms").doc(currentVoiceRoom);
  const roomSnapshot = await roomRef.get();
  if(roomSnapshot.exists && roomSnapshot.data()?.offer){
    await answerCall();
  } else {
    await startWebRTC();
  }
  await startWebRTC();
  voiceStatus.textContent = "Connected";
}

async function leaveVoice(){
  voiceStatus.textContent = "Not connected";
  voiceBadge.textContent = "Offline";
  voiceBadge.classList.remove("live");
  voiceBadge.classList.add("offline");
  await db.collection("voiceRooms").doc(currentVoiceRoom).collection("participants").doc(currentUser.uid).delete();
  Object.values(peerConnections).forEach(pc => pc.close());
  peerConnections = {};
  if(localStream){
    localStream.getTracks().forEach(track => track.stop());
  }
  localStream = null;
  remoteAudioElements.forEach(audio => audio.remove());
  remoteAudioElements.clear();
}

startVoiceBtn.addEventListener("click", joinVoice);
leaveVoiceBtn.addEventListener("click", leaveVoice);

async function startWebRTC(){
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const roomRef = db.collection("voiceRooms").doc(currentVoiceRoom);
  const callerCandidates = roomRef.collection("callerCandidates");
  const calleeCandidates = roomRef.collection("calleeCandidates");

  const peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  peerConnection.onicecandidate = event => {
    if(event.candidate){
      callerCandidates.add(event.candidate.toJSON());
    }
  };

  peerConnection.ontrack = event => {
    const audio = document.createElement("audio");
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
    audio.controls = false;
    audio.classList.add("remote-audio");
    document.body.appendChild(audio);
    remoteAudioElements.add(audio);
    document.body.appendChild(audio);
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await roomRef.set({ offer }, { merge: true });

  roomRef.onSnapshot(async snapshot => {
    const data = snapshot.data();
    if(!peerConnection.currentRemoteDescription && data?.answer){
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });

  calleeCandidates.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if(change.type === "added"){
        const candidate = new RTCIceCandidate(change.doc.data());
        peerConnection.addIceCandidate(candidate);
      }
    });
  });

  peerConnections[currentVoiceRoom] = peerConnection;
}

async function answerCall(){
  const roomRef = db.collection("voiceRooms").doc(currentVoiceRoom);
  const roomSnapshot = await roomRef.get();
  const roomData = roomSnapshot.data();
  if(!roomData?.offer){
    return;
  }

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  const calleeCandidates = roomRef.collection("calleeCandidates");
  peerConnection.onicecandidate = event => {
    if(event.candidate){
      calleeCandidates.add(event.candidate.toJSON());
    }
  };

  peerConnection.ontrack = event => {
    const audio = document.createElement("audio");
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
    audio.controls = false;
    audio.classList.add("remote-audio");
    document.body.appendChild(audio);
    remoteAudioElements.add(audio);
    document.body.appendChild(audio);
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(roomData.offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  await roomRef.set({ answer }, { merge: true });

  roomRef.collection("callerCandidates").onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if(change.type === "added"){
        const candidate = new RTCIceCandidate(change.doc.data());
        peerConnection.addIceCandidate(candidate);
      }
    });
  });

  peerConnections[currentVoiceRoom] = peerConnection;
}

async function syncVoiceRoomOffer(){
  const roomRef = db.collection("voiceRooms").doc(currentVoiceRoom);
  roomRef.onSnapshot(snapshot => {
    const data = snapshot.data();
    if(data?.offer && !peerConnections[currentVoiceRoom]){
      answerCall();
    }
  });
}

async function ensureUserProfile(user){
  if(!user){
    return;
  }
  const userRef = db.collection("users").doc(user.uid);
  const doc = await userRef.get();
  if(!doc.exists){
    await userRef.set({
      handle: user.email?.split("@")[0] || "New User",
      status: "Working",
      email: user.email,
      online: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return;
  }
  const data = doc.data();
  const updates = {};
  if(!data?.email && user.email){
    updates.email = user.email;
  }
  if(Object.keys(updates).length){
    updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await userRef.set(updates, { merge: true });
  }
}

async function showApp(user){
  currentUser = user;
  authOverlay.classList.add("hidden");
  if(user){
    await ensureUserProfile(user);
function showApp(user){
  currentUser = user;
  authOverlay.classList.add("hidden");
  if(user){
    db.collection("users").doc(user.uid).set({
      online: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    db.collection("users").doc(user.uid).get().then(doc => {
      const data = doc.data();
      accountName.textContent = data?.handle || user.email;
      accountStatus.textContent = data?.status || "Working";
    });
  }
  subscribeToPresence();
  subscribeToFriends();
  setChannel(currentChannelId);
  setChannel(currentChannel);
  subscribeToVoiceRoom();
  syncVoiceRoomOffer();
}

function resetApp(){
  currentUser = null;
  authOverlay.classList.remove("hidden");
  accountName.textContent = "guest";
  accountStatus.textContent = "Offline";
  dmList.innerHTML = "";
  friendsError.textContent = "";
  if(unsubscribeMessages){
    unsubscribeMessages();
  }
  if(unsubscribePresence){
    unsubscribePresence();
  }
  if(unsubscribeVoice){
    unsubscribeVoice();
  }
  if(unsubscribeFriends){
    unsubscribeFriends();
  }
}

auth.onAuthStateChanged(user => {
  if(user){
    showApp(user);
  } else {
    resetApp();
  }
});

function formatAuthError(error){
  if(error?.code === "auth/configuration-not-found"){
    return "Firebase Auth is not fully configured. Ensure Email/Password auth is enabled and your domain is added to Authorized Domains in Firebase Auth settings.";
  }
  if(error?.code === "auth/network-request-failed"){
    return "Network error. Check your internet connection and Firebase config.";
  }
  return error?.message || "Authentication failed. Please try again.";
}
