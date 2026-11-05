const fs = require('fs');

const html = fs.readFileSync('spotify-search/index.html', 'utf8');
const appJs = fs.readFileSync('spotify-search/app.js', 'utf8');

console.log('=== VERIFYING DOM INTERACTION INTEGRITY ===');

// 1. Verify all modal overlays and close buttons
const modals = [
  { id: 'auth-modal-overlay', closeBtn: 'btn-close-auth-modal', fn: 'closeAuthModal' },
  { id: 'profile-modal-overlay', closeBtn: 'btn-close-profile-modal', fn: 'closeProfileModal' },
  { id: 'chat-modal-overlay', closeBtn: 'btn-close-chat-modal', fn: 'closeChatModal' },
  { id: 'feedback-modal-overlay', closeBtn: 'btn-close-feedback-modal', fn: 'closeFeedbackModal' },
  { id: 'lyrics-modal-overlay', closeBtn: 'btn-close-lyrics-modal', fn: 'closeLyricsModal' },
  { id: 'security-modal-overlay', closeBtn: 'btn-close-security-modal', fn: 'closeSecurityModal' },
  { id: 'create-playlist-modal-overlay', closeBtn: 'btn-close-create-playlist-modal', fn: 'closeCreatePlaylistModal' },
  { id: 'equalizer-modal-overlay', closeBtn: 'btn-close-eq-modal', fn: 'closeEqualizerModal' }
];

let failed = 0;

for (const m of modals) {
  const hasOverlay = html.includes(`id="${m.id}"`);
  const hasClose = html.includes(`id="${m.closeBtn}"`);
  const hasInlineClose = html.includes(`id="${m.closeBtn}"`) && html.match(new RegExp(`id="${m.closeBtn}"[^>]*onclick="[^"]*${m.id}`));
  const hasWindowExport = appJs.includes(`window.${m.fn} = ${m.fn}`);

  console.log(`Modal: ${m.id}`);
  console.log(`  - HTML Overlay exists: ${hasOverlay}`);
  console.log(`  - Close Button exists: ${hasClose}`);
  console.log(`  - Inline onclick fail-safe: ${!!hasInlineClose}`);
  console.log(`  - Window export: ${hasWindowExport}`);

  if (!hasOverlay || !hasClose || !hasInlineClose || !hasWindowExport) {
    failed++;
    console.error(`  ❌ Modal ${m.id} failed checks!`);
  } else {
    console.log(`  ✅ Passed all checks!`);
  }
}

// 2. Verify Auth Tab Switchers
const hasLoginTabClick = html.includes('id="auth-tab-login"') && html.match(/id="auth-tab-login"[^>]*onclick="[^"]*openAuthModal\('login'\)/);
const hasRegisterTabClick = html.includes('id="auth-tab-register"') && html.match(/id="auth-tab-register"[^>]*onclick="[^"]*openAuthModal\('register'\)/);
const hasHiddenConfirmGroup = html.includes('id="auth-confirm-group"') && html.includes('class="auth-field-group hidden"');
const hasAuthAlertEmptyCss = fs.readFileSync('spotify-search/styles.css', 'utf8').includes('.auth-alert:empty');

console.log('\n=== AUTH MODAL FIXES ===');
console.log(`  - Login Tab inline onclick: ${!!hasLoginTabClick}`);
console.log(`  - Register Tab inline onclick: ${!!hasRegisterTabClick}`);
console.log(`  - Confirm group hidden by default: ${hasHiddenConfirmGroup}`);
console.log(`  - Empty auth alert CSS guard: ${hasAuthAlertEmptyCss}`);

if (!hasLoginTabClick || !hasRegisterTabClick || !hasHiddenConfirmGroup || !hasAuthAlertEmptyCss) {
  failed++;
  console.error('  ❌ Auth modal fixes incomplete!');
} else {
  console.log('  ✅ Auth modal checks passed!');
}

console.log(`\nOVERALL STATUS: ${failed === 0 ? '🎉 ALL CHECKS PASSED (100%)' : `⚠️ ${failed} CHECKS FAILED`}`);
process.exit(failed > 0 ? 1 : 0);

