// src/components/marketing/GameJamBanner.jsx
const GameJamBanner = () => {
  return (
    <a
      target="_blank"
      href="https://jam.pieter.com"
      style={{
        fontFamily: "'system-ui', sans-serif",
        position: 'fixed',
        bottom: '-1px',
        right: '-1px',
        padding: '7px',
        fontSize: '14px',
        fontWeight: 'bold',
        background: '#fff',
        color: '#000',
        textDecoration: 'none',
        zIndex: 10,
        borderTopLeftRadius: '12px',
        border: '1px solid #fff',
      }}
    >
      🕹️ Vibe Jam 2025
    </a>
  );
};

export default GameJamBanner;
