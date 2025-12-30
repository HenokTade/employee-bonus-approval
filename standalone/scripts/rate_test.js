(async ()=>{
  const url = 'http://localhost:3000/api/auth/login';
  for (let i = 0; i < 7; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `rate-${i}@example.test`, password: 'nope' })
      });
      const text = await res.text();
      console.log(`Attempt ${i} => ${res.status} | ${text}`);
    } catch (err) {
      console.error(`Attempt ${i} => ERROR`, err.message);
    }
    await new Promise(r => setTimeout(r, 200));
  }
})();
