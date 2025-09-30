<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Drushyasinchana</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>

<header>
  <div class="logo">
    <img src="assets/images/logo-wo-bg1.jpg" alt="Drushyasinchana Logo" width="36" height="36" />
    Drushyasinchana
  </div>
  <nav>
    <a href="#home" class="active">Home</a>
    <a href="#services">Services</a>
    <a href="#videos">Videos</a>
    <a href="#about">About</a>
    <a href="contact.html">Contact</a>
  </nav>
  <button class="contact-button" onclick="window.location.href='contact.html';">Contact</button>
</header>

<main>
  <section id="home" class="hero">
    <h1>Drushyasinchana</h1>
    <p class="lead">
      Your trusted partner for <strong>Legal</strong>, <strong>IT</strong>, <span class="tech">Tech</span> & <span class="creative">Creative</span> Solutions
    </p>
    <p>Bridging technology and law with 27+ years of experience in Karnataka Judiciary. From server management to legal drafting, we deliver comprehensive multiservice solutions.</p>
    <div class="buttons">
      <a href="#services" class="btn-primary">Explore Services</a>
      <a href="contact.html" class="btn-secondary">Get In Touch</a>
    </div>
    <footer>
      <p>📞 <a href="tel:+9448209323">9448209323</a> | ✉️ <a href="mailto:drushyasinchana@gmail.com">drushyasinchana@gmail.com</a> | 📍 Karnataka, India</p>
    </footer>
  </section>

  <section id="services" class="services">
    <h2>Our <span style="color:#2c62ff;">Services</span></h2>
    <p class="subtitle">Comprehensive solutions spanning legal, technology, creative, and business domains with decades of expertise.</p>
    <div class="cards">
      <div class="service-card">
        <h3>IT Support &amp; Administration</h3>
        <ul>
          <li>Comprehensive IT solutions including server management, network troubleshooting, and system administration.</li>
          <li>Server Management &amp; Maintenance</li>
          <li>Network &amp; System Troubleshooting</li>
          <li>Data Backup &amp; Recovery</li>
          <li>IT Inventory Management</li>
          <li>User Support &amp; Technical Assistance</li>
        </ul>
      </div>
      <div class="service-card">
        <h3>Legal Services</h3>
        <ul>
          <li>Professional legal assistance with 27+ years of judiciary experience and advocate registration.</li>
          <li>Legal Drafting &amp; Documentation</li>
          <li>Contract Review &amp; Analysis</li>
          <li>Legal Notice Services</li>
          <li>IT Returns Filing Assistance</li>
          <li>Judicial Process Guidance</li>
        </ul>
      </div>
      <div class="service-card">
        <h3>Creative Services</h3>
        <ul>
          <li>Professional creative solutions for visual and multimedia needs</li>
          <li>Adobe Photoshop Editing</li>
          <li>Video Editing (Premiere Pro)</li>
          <li>Graphic Design Solutions</li>
          <li>Brand Identity Development</li>
          <li>Multimedia Content Creation</li>
        </ul>
      </div>
      <div class="service-card">
        <h3>Website Development</h3>
        <ul>
          <li>Modern, responsive websites &amp; hosting solutions tailored to your business needs.</li>
          <li>Custom Website Development</li>
          <li>Responsive Design Implementation</li>
          <li>Website Hosting Solutions</li>
          <li>Domain Management</li>
          <li>SEO Optimization</li>
        </ul>
      </div>
      <div class="service-card">
        <h3>Security Solutions</h3>
        <ul>
          <li>Comprehensive security systems and surveillance solutions for your business.</li>
          <li>Biometric Attendance Systems</li>
          <li>Surveillance System Setup</li>
          <li>Firewall Configuration</li>
          <li>Network Security Audits</li>
          <li>Data Protection Solutions</li>
        </ul>
      </div>
      <div class="service-card">
        <h3>AI &amp; Technology Integration</h3>
        <ul>
          <li>Leverage cutting-edge AI tools and modern technology for business optimization.</li>
          <li>AI Tools Integration (ChatGPT, Gemini)</li>
          <li>Process Automation</li>
          <li>Technology Consulting</li>
          <li>Digital Transformation</li>
          <li>Custom Software Solutions</li>
        </ul>
      </div>
    </div>
  </section>

  <section id="videos" class="videos">
    <h2>Latest <span style="color:#d1445f;">Videos</span></h2>
    <p class="subtitle">Stay updated with our educational content, tutorials, and insights across YouTube and Instagram.</p>
    <div class="video-buttons">
      <a href="https://www.youtube.com" target="_blank" rel="noopener" class="youtube-btn">YouTube Channel</a>
      <a href="https://www.instagram.com" target="_blank" rel="noopener" class="instagram-btn">Instagram</a>
    </div>
    <div class="video-grid">
      <div class="video-card">
        <div class="badge">YouTube</div>
        <img src="assets/images/1.jpg" alt="IT Support Best Practices" />
        <div class="video-info">
          <h4>IT Support Best Practices</h4>
          <p>Essential tips for maintaining enterprise systems and networks</p>
          <a href="https://www.youtube.com/watch?v=example" target="_blank" rel="noopener" class="watch-link">Watch Now</a>
        </div>
      </div>
      <div class="video-card">
        <div class="badge">YouTube</div>
        <img src="assets/images/2.jpg" alt="Legal Documentation Guide" />
        <div class="video-info">
          <h4>Legal Documentation Guide</h4>
          <p>Step-by-step process for proper legal document preparation</p>
          <a href="https://www.youtube.com/watch?v=example2" target="_blank" rel="noopener" class="watch-link">Watch Now</a>
        </div>
      </div>
      <div class="video-card">
        <div class="badge instagram">Instagram</div>
        <img src="assets/images/3.jpg" alt="Creative Workflow Tips" />
        <div class="video-info">
          <h4>Creative Workflow Tips</h4>
          <p>Behind the scenes: Our creative process and tools</p>
          <a href="https://www.instagram.com/example" target="_blank" rel="noopener" class="watch-link">Watch Now</a>
        </div>
      </div>
      <div class="video-card">
        <div class="badge">YouTube</div>
        <img src="assets/images/4.jpg" alt="Website Development Journey" />
        <div class="video-info">
          <h4>Website Development Journey</h4>
          <p>From concept to deployment: Building modern websites</p>
          <a href="https://www.youtube.com/watch?v=example3" target="_blank" rel="noopener" class="watch-link">Watch Now</a>
        </div>
      </div>
      <div class="video-card">
        <div class="badge instagram">Instagram</div>
        <img src="assets/images/5.jpg" alt="AI Tools Integration" />
        <div class="video-info">
          <h4>AI Tools Integration</h4>
          <p>Leveraging ChatGPT and Gemini for business solutions</p>
          <a href="https://www.instagram.com/example2" target="_blank" rel="noopener" class="watch-link">Watch Now</a>
        </div>
      </div>
      <div class="video-card">
        <div class="badge">YouTube</div>
        <img src="assets/images/6.jpg" alt="Security Systems Setup" />
        <div class="video-info">
          <h4>Security Systems Setup</h4>
          <p>Complete guide to biometric and surveillance systems</p>
          <a href="https://www.youtube.com/watch?v=example4" target="_blank" rel="noopener" class="watch-link">Watch Now</a>
        </div>
      </div>
    </div>
  </section>

  <section id="about" class="about">
    <h2>About <span style="color:#2c62ff;">Drushyasinchana</span></h2>
    <p>Bridging the gap between technology and law with decades of expertise and a passion for innovation.</p>
    <h3>Meet Murthy SNV</h3>
    <p>With over 27 years of distinguished service in the Karnataka Judiciary, Murthy SNV brings a unique blend of legal expertise and technical proficiency to every project. As the founder of Drushyasinchana, he has successfully bridged the traditionally separate worlds of law and technology.</p>
    <p>From serving as Stenographer & Technical Support Staff to becoming a Registered Advocate, Murthy's journey showcases a commitment to continuous learning and adaptation to emerging technologies.</p>
    <h4>Education & Certifications</h4>
    <ul>
      <li>Master of Computer Applications (MCA)</li>
      <li>Post Graduate Diploma in Human Resource Management (PGDHRM)</li>
      <li>Bachelor of Laws (LL.B.)</li>
      <li>Bachelor of Commerce (B.Com)</li>
      <li>Diploma in Stenography</li>
    </ul>
    <h4>Professional Certifications</h4>
    <ul>
      <li>Sun Certified Java Programmer (SCJP)</li>
      <li>Registered Advocate</li>
    </ul>
    <button class="collab-btn">Let's Collaborate</button>
  </section>
</main>

<footer class="site-footer">
  <div class="col">
    <h3>Drushyasinchana</h3>
    <p>Your trusted partner for Legal, IT, Tech & Creative Solutions. Bridging technology and law with 27+ years of expertise in Karnataka Judiciary.</p>
    <p>✉️ <a href="mailto:drushyasinchana@gmail.com">drushyasinchana@gmail.com</a><br/>
       📞 <a href="tel:+9448209323">9448209323</a><br/>
       📍 Karnataka, India
    </p>
  </div>
  <div class="col">
    <h3>Quick Links</h3>
    <a href="#home">Home</a>
    <a href="#services">Services</a>
    <a href="#videos">Videos</a>
    <a href="#about">About</a>
    <a href="contact.html">Contact</a>
  </div>
  <div class="col">
    <h3>Our Services</h3>
    <a href="#it-support">IT Support & Administration</a>
    <a href="#legal-services">Legal Services</a>
    <a href="#creative-services">Creative Services</a>
    <a href="#web-development">Website Development</a>
    <a href="#security-solutions">Security Solutions</a>
    <a href="#ai-integration">AI & Technology Integration</a>
  </div>
  <div class="col">
    <h3>Connect With Us</h3>
    <div class="social-icons">
      <a href="https://www.youtube.com/" target="_blank" rel="noopener" title="YouTube">YT</a>
      <a href="https://www.instagram.com/" target="_blank" rel="noopener" title="Instagram" style="background:#c732a3;">IG</a>
    </div>
    <p>Visit our website:<br/><a href="https://drushyasinchana.in" target="_blank" rel="noopener">drushyasinchana.in</a></p>
  </div>
  <div class="bottom-row">
    <div>© 2025 Drushyasinchana. All rights reserved.</div>
    <div>Made with <span class="heart">♥</span> by Drushyasinchana</div>
    <div>Registered Advocate: KAR/3037/2024</div>
  </div>
</footer>

<script src="script.js"></script>
</body>
</html>
