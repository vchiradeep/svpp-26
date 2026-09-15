import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://thkzhovphluncnxzfqgs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoa3pob3ZwaGx1bmNueHpmcWdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NTQ4MjUsImV4cCI6MjEwNTAzMDgyNX0.Tq_c9Gmltkxjr2rZNEGfbbZFkaFoP33gDtqQcaP7sns';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);