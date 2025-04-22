import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
dotenv.config();

// Validate Supabase configuration
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Supabase configuration missing. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
  );
}

// Create Supabase admin client (with service role key)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const setupSupabaseAuth = async () => {
  try {
    console.log('Starting Supabase Auth setup...');

    // Get all users from our database
    const dbUsers = await db.select().from(users);
    console.log(`Found ${dbUsers.length} users in the database`);

    // For each user in our database, create a user in Supabase Auth
    for (const user of dbUsers) {
      try {
        console.log(`Processing user: ${user.email}`);
        
        // Check if user already exists in Supabase Auth
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({
          filters: {
            email: user.email
          }
        });
        
        if (existingUsers && existingUsers.users.length > 0) {
          console.log(`User ${user.email} already exists in Supabase Auth`);
          continue;
        }
        
        // Create user in Supabase Auth
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            full_name: user.fullName,
            role: user.role,
            school_id: user.schoolId
          }
        });
        
        if (error) {
          console.error(`Error creating user ${user.email} in Supabase Auth:`, error);
        } else {
          console.log(`User ${user.email} created in Supabase Auth with ID: ${data.user.id}`);
          
          // Update our user record with the Supabase Auth ID
          await db.update(users)
            .set({ supabaseId: data.user.id })
            .where(eq(users.id, user.id));
            
          console.log(`Updated user ${user.email} with Supabase Auth ID`);
        }
      } catch (err) {
        console.error(`Error processing user ${user.email}:`, err);
      }
    }
    
    console.log('Supabase Auth setup completed');
  } catch (error) {
    console.error('Error setting up Supabase Auth:', error);
  }
};

// Run the setup
setupSupabaseAuth();