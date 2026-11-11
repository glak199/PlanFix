// PlanFix product content. The visual palette is shared with the application.
export const SUPPORT_EMAIL='useplanfix@gmail.com';
export function supportMailto(topic='General question',message='') {
  const subject=`PlanFix support — ${String(topic).replace(/[\r\n]/g,' ').slice(0,80)}`;
  const body=`Hello PlanFix team,\n\n${String(message).slice(0,4000)}\n\nPage or plan involved (if relevant):\nDevice and browser:\n`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
export function landingPage({icon,googleButton,authCard}) {
  const features=[
    ['calendar','The details, in one place','Give your plan a name, date, time, and location. Everyone in the plan can check the same details.'],
    ['list','A decision everyone can join','Add voting options and let participants choose. Review the results before you confirm the plan.'],
    ['users','Groups for recurring plans','Create a group for friends, classmates, or teammates so related plans have a shared home.']
  ];
  const steps=[['01','Sign in with Google','Use your Google account to create or access your PlanFix profile.'],['02','Create your plan','Add the details and the options you want participants to vote on.'],['03','Share the invitation','Send the plan link to participants. They sign in with Google to join and vote.'],['04','Confirm the decision','Review the votes, confirm the plan, and keep the final details ready to check.']];
  const questions=[
    ['What can I plan with PlanFix?','Use PlanFix for a dinner, a weekend outing, a study session, or an event with friends. Each plan has its own details, participants, and voting options.'],
    ['Does everyone need an account?','Yes. You and your participants sign in with Google before creating or joining a plan. New users get a PlanFix account during Google sign-in.'],
    ['How do invitations work?','Create a plan and copy its invitation link. Send it to the intended participants. Anyone with the link can join after signing in, so share it with people you want in that plan.'],
    ['Can I return to my plans later?','Your plans, groups, and votes are saved to your account. Sign in with the same Google account to access them again.'],
    ['Does PlanFix book venues or take payments?','PlanFix helps you organize details and decide together. Reservations, tickets, payments, and travel bookings are arranged separately.']
  ];
  return `<div class="welcome-page planfix-home">
    <a class="skip-link" href="#welcome-main">Skip to content</a>
    <header class="welcome-header"><div class="welcome-container header-inner">
      <a class="welcome-brand" href="/" aria-label="PlanFix home"><img src="/assets/favicon.svg" alt=""><span>planfix<span class="brand-period">.</span></span></a>
      <span class="brand-caption">Plans. Votes.<br>Decisions.</span>
      <nav class="welcome-nav" aria-label="Homepage navigation"><a href="#features">What you can do</a><a href="#how-it-works">How it works</a><a href="#support">Help & support</a><a class="welcome-signin" href="#signin">Sign in ${icon('arrow')}</a></nav>
    </div></header>
    <main id="welcome-main">
      <div class="welcome-container welcome-layout home-hero">
        <section class="welcome-pitch" aria-labelledby="home-title">
          <p class="welcome-kicker"><span></span> YOUR GROUP PLANNING WORKSPACE</p>
          <h1 id="home-title">Make a plan.<br><em>Get a decision.</em><br>Make it happen.</h1>
          <p class="welcome-description">A plan needs more than a message. PlanFix brings the details, participants, and votes into one shared space—so your group can decide what’s next.</p>
          <div class="welcome-actions">${googleButton('Create your first plan','create','start-planning')}</div>
          <p class="welcome-hint">Sign in with Google to create your account or return to your plans.</p>
          <div class="hero-capabilities" aria-label="PlanFix capabilities"><span>${icon('calendar')}Shared details</span><span>${icon('list')}Group voting</span><span>${icon('shield')}Saved to your account</span></div>
          <div class="plan-preview" aria-label="Illustrative PlanFix plan, not a live plan">
            <div class="preview-caption"><span>INSIDE A PLAN</span><span>Illustrative example</span></div>
            <div class="preview-plan-heading"><div class="preview-calendar">${icon('calendar')}</div><div><strong>Saturday catch-up</strong><small>Dinner · 7:00 PM · City centre</small></div><span class="preview-state">Voting open</span></div>
            <div class="preview-question">Which place works for the group?</div>
            <div class="preview-option"><span class="preview-bar" style="width:60%"></span><span>Riverside café</span><b>3 votes</b></div>
            <div class="preview-option"><span class="preview-bar" style="width:40%"></span><span>The pizza place</span><b>2 votes</b></div>
            <div class="preview-footnote">${icon('check')}A shared view of the choices before the organizer confirms.</div>
          </div>
        </section>
        ${authCard}
      </div>
      <section id="features" class="home-section feature-section">
        <div class="welcome-container"><div class="home-section-heading"><div><p class="home-kicker">WHAT PLANFIX DOES</p><h2>A clear plan.<br>A choice the group can see.</h2></div><p>Keep the information behind a decision together, from the first idea to the confirmed plan.</p></div>
          <div class="product-features">${features.map(([i,title,description])=>`<article><div class="product-feature-icon">${icon(i)}</div><h3>${title}</h3><p>${description}</p></article>`).join('')}</div>
          <div class="account-feature"><span class="account-feature-icon">${icon('bookmark')}</span><div><h3>Your planning dashboard</h3><p>See upcoming and past plans, check your calendar, and open your groups after signing in. Bookmark plans on your device for easy access.</p></div><a href="#signin">Open your account ${icon('arrow')}</a></div>
        </div>
      </section>
      <section id="how-it-works" class="home-section workflow-section welcome-container">
        <div class="home-section-heading"><div><p class="home-kicker">FROM IDEA TO CONFIRMED PLAN</p><h2>Four steps. One place to follow.</h2></div><p>You create the plan. Participants make their choices. The organizer confirms the decision.</p></div>
        <ol class="planning-steps">${steps.map(([n,title,description])=>`<li><span class="planning-step-number">${n}</span><h3>${title}</h3><p>${description}</p></li>`).join('')}</ol>
      </section>
      <section class="home-section occasions-section"><div class="welcome-container occasions-layout">
        <div><p class="home-kicker">FOR THE PLANS YOU ALREADY MAKE</p><h2>From a quick meetup<br>to a weekend away.</h2><p>PlanFix gives everyday plans a shared structure. Start with the activity and add the choices your group needs to settle.</p><a href="#signin" class="occasion-cta">Start a plan with Google ${icon('arrow')}</a></div>
        <div class="occasion-list"><article><span>01</span><div><h3>Dinners & meetups</h3><p>Keep the time and location visible while the group chooses a place.</p></div>${icon('pin')}</article><article><span>02</span><div><h3>Trips & day outings</h3><p>List destination or activity options and see which choice gets the votes.</p></div>${icon('calendar')}</article><article><span>03</span><div><h3>Study sessions & group events</h3><p>Set the session details, invite participants, and keep related plans in a group.</p></div>${icon('users')}</article></div>
      </div></section>
      <section class="home-section faq-section welcome-container" aria-labelledby="faq-title"><div class="faq-intro"><p class="home-kicker">BEFORE YOU START</p><h2 id="faq-title">A few useful answers.</h2><p>More questions? Our support email is below.</p></div><div class="faq-list">${questions.map(([q,a])=>`<details><summary>${q}${icon('plus')}</summary><p>${a}</p></details>`).join('')}</div></section>
      <section id="support" class="home-section support-section"><div class="welcome-container support-layout">
        <div class="support-intro"><div class="support-icon">${icon('mail')}</div><p class="home-kicker">PLANFIX HELP & CUSTOMER CARE</p><h2>Something not<br>working as expected?</h2><p>Tell us about a sign-in issue, a plan that won’t open, a voting problem, or an idea to improve PlanFix.</p><a class="support-email" href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL} ${icon('arrow')}</a><p class="support-tip">Include what happened, what you expected, and your device or browser. Please keep passwords and verification codes out of your message.</p></div>
        <form id="support-form" class="support-form"><h3>Describe your issue</h3><label class="field">What do you need help with?<select name="topic"><option>General question</option><option>Google sign-in</option><option>Creating or joining a plan</option><option>Voting or plan details</option><option>Feedback or suggestion</option></select></label><label class="field">Your message<textarea name="message" required minlength="10" maxlength="4000" placeholder="Tell us what happened and how we can help…"></textarea></label><button class="button primary wide" type="submit">${icon('mail')}Write support email ${icon('arrow')}</button><p class="support-form-note">Opens a draft in your email app. Send it there to contact PlanFix.</p><a id="support-draft" hidden href="${supportMailto()}">Open support email draft</a><p id="support-status" class="support-form-note" role="status"></p></form>
      </div></section>
    </main>
    <footer class="welcome-container product-footer"><div class="product-footer-top"><a class="welcome-brand" href="/" aria-label="PlanFix home"><span>planfix<span class="brand-period">.</span></span></a><p>Plan details. Group choices. Confirmed decisions.</p><div><a href="#features">Features</a><a href="#support">Help & support</a><button data-action="privacy">Privacy</button></div></div><div class="product-footer-bottom"><span>© ${new Date().getFullYear()} PlanFix</span><span>Google sign-in required to use PlanFix.</span></div><p class="founder-credit">The Startup is Made by Yashvir Paul</p></footer>
  </div>`;
}
