import { createClient } from "@supabase/supabase-js";

// SuperCool managed database (public url + anon key).
const url = "https://prj1ff2e151191b2cb1e4f5.databasepad.com";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImVjYTQ2MjZjLTM5ZjUtNDMzNC04NTJkLWI5MWNlMGEzNzg2OCJ9.eyJwcm9qZWN0SWQiOiJwcmoxZmYyZTE1MTE5MWIyY2IxZTRmNSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzg2NzI4ODM1LCJleHAiOjIxMDIwODg4MzUsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.oG3sx-0BrAgpOzgcElkLuAoQuf7V9IFKzrORY9XG6LM";

export const db = createClient(url, anonKey);
export default db;
