import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://upzurluvuulgchnowgqs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwenVybHV2dXVsZ2Nobm93Z3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTY3NTMsImV4cCI6MjEwNTgzMjc1M30.LCKSEI1YfnkE3BnBE4f_aqKZIrvFoiRNZZC119LRNTQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);