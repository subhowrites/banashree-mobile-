export async function onRequest(context) {

  const { request } = context;

  if (request.method !== "POST") {
    return new Response(JSON.stringify({
      success:false,
      error:"Method not allowed"
    }), {
      status:405,
      headers:{ "Content-Type":"application/json" }
    });
  }

  const body = await request.json();

  const email = body.email;
  const password = body.password;

  const ADMIN_EMAIL = "admin@banashree.com";
  const ADMIN_PASSWORD = "admin123";

  if(email === ADMIN_EMAIL && password === ADMIN_PASSWORD){

    return new Response(JSON.stringify({
      success:true,
      message:"Login successful"
    }),{
      headers:{ "Content-Type":"application/json" }
    });

  }

  return new Response(JSON.stringify({
    success:false,
    error:"Invalid credentials"
  }),{
    status:401,
    headers:{ "Content-Type":"application/json" }
  });

}