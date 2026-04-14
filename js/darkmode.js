// Dark mode toggle - persists preference in localStorage
(function(){
  const toggle = document.getElementById('themeToggle');
  const icon = document.getElementById('themeIcon');
  const root = document.documentElement;

  function setDark(dark){
    if(dark){
      root.classList.add('dark');
      icon.className = 'fas fa-sun text-2xl';
      localStorage.setItem('theme','dark');
      
      // Force UI update for dynamic elements
      updateDarkModeUI();
    } else {
      root.classList.remove('dark');
      icon.className = 'fas fa-moon text-2xl';
      localStorage.setItem('theme','light');
      
      // Force UI update for dynamic elements
      updateDarkModeUI();
    }
  }

  function updateDarkModeUI(){
    // Trigger any CSS recalculations
    document.body.style.opacity = '0.99';
    setTimeout(() => {
      document.body.style.opacity = '1';
    }, 10);
  }

  // Initialize
  try{
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(saved === 'dark' || (saved === null && prefersDark));
  }catch(e){
    setDark(false);
  }

  if(toggle){
    toggle.addEventListener('click', ()=>{
      setDark(!root.classList.contains('dark'));
    });
  }
})();
