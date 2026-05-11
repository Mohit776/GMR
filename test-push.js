const SUPABASE_URL = 'https://seztspieqhmogcrnojfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlenRzcGllcWhtb2djcm5vamZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzczMDQsImV4cCI6MjA5MzQxMzMwNH0.S5QpzIAd8UzyMT5He96E1VLHecyGxXpbc824kWrGOtI';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

async function main() {
  console.log('Fetching users from Supabase...');
  const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,email,fcm_tokens`, { headers });
  
  if (!usersRes.ok) {
    const errorText = await usersRes.text();
    console.error('Error fetching users:', usersRes.status, errorText);
    return;
  }
  
  const users = await usersRes.json();
  const usersWithTokens = users.filter(u => u.fcm_tokens && u.fcm_tokens.length > 0);
  console.log(`Found ${usersWithTokens.length} users with FCM tokens.`);

  for (const user of usersWithTokens) {
    console.log(`Sending push to user ${user.email} (${user.id})...`);
    
    const pushPayload = {
      userId: user.id,
      title: 'Test Notification from AI Assistant!',
      body: 'If you see this banner in the foreground, it works!',
      data: {
        test: 'true',
        timestamp: new Date().toISOString()
      }
    };

    const pushRes = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers,
      body: JSON.stringify(pushPayload)
    });

    if (!pushRes.ok) {
      const errorText = await pushRes.text();
      console.error(`Error sending to ${user.email}:`, pushRes.status, errorText);
    } else {
      const result = await pushRes.json();
      console.log(`Success for ${user.email}:`, result);
    }
  }
}

main().catch(console.error);
