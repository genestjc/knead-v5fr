export function freemiumWelcomeEmail() {
  return `
  <html>
    <head>
      <style>
        @import url("https://use.typekit.net/gne1bgd.css");
        .adonis { font-family: 'adonis', serif; font-size: 2rem; }
        .georgia-pro { font-family: 'georgia-pro', serif; font-size: 1.1rem; }
        .italic { font-style: italic; }
        .cta { margin-top: 2rem; }
      </style>
    </head>
    <body>
      <div class="adonis">Welcome to Knead</div>
      <div class="georgia-pro italic" style="margin-top:1rem;">
        Thank you for signing up.<br><br>
        Enjoy a few stories on us every month covering some of the most intriguing conversations around creativity and culture.
      </div>
      <div class="georgia-pro cta" style="margin-top:2rem;">
        <span>Interested in unlimited access? </span>
        <a href="https://kneadmag.com/join" class="italic" style="font-style:italic;">Become a Knead Monthly member today</a>
      </div>
    </body>
  </html>
  `;
}

export function premiumWelcomeEmail() {
  return `
  <html>
    <head>
      <style>
        @import url("https://use.typekit.net/gne1bgd.css");
        .adonis { font-family: 'adonis', serif; font-size: 2rem; }
        .georgia-pro { font-family: 'georgia-pro', serif; font-size: 1.1rem; }
        .italic { font-style: italic; }
      </style>
    </head>
    <body>
      <div class="adonis">Welcome to Knead Monthly</div>
      <div class="georgia-pro" style="margin-top:1rem;">
        Thank you for becoming a member.<br><br>
        Enjoy unlimited access to stories, our group chat, and other perks.
      </div>
      <div class="georgia-pro italic" style="margin-top:2rem;">
        <a href="https://www.kneadmag.com/" style="font-style:italic;">kneadmag.com</a>
      </div>
    </body>
  </html>
  `;
}

export function cancellationEmail() {
  return `
  <html>
    <head>
      <style>
        @import url("https://use.typekit.net/gne1bgd.css");
        .adonis { font-family: 'adonis', serif; font-size: 2rem; }
        .georgia-pro { font-family: 'georgia-pro', serif; font-size: 1.1rem; }
        .italic { font-style: italic; }
      </style>
    </head>
    <body>
      <div class="adonis">Thank you for supporting Knead.</div>
      <div class="georgia-pro" style="margin-top:1rem;">
        We appreciate you being a Knead Monthly member. Come back and join us any time.<br><br>
        If you cancelled by mistake sign-up again at the link below.
      </div>
      <div class="georgia-pro italic" style="margin-top:2rem;">
        <a href="https://kneadmag.com/join" style="font-style:italic;">kneadmag.com/join</a>
      </div>
    </body>
  </html>
  `;
}
