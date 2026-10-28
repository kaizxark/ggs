/**
 * Test environment defaults.
 *
 * Every route that talks to Supabase reads `SUPABASE_SECRET_KEY` at module
 * load and refuses to serve traffic when it is missing, answering 503
 * "not_configured". That is the right behaviour in production, but it means
 * the route tests all failed on a developer machine that had no secret key in
 * its environment — 71 of them, all with the same cause, and none of them
 * testing anything real.
 *
 * The value below is a placeholder, not a credential. The tests stub `fetch`,
 * so nothing here ever reaches a live Supabase project: the key only has to be
 * present and non-empty for the routes to get past their own configuration
 * check and exercise the logic underneath.
 *
 * A real key in the environment still wins, so a test run against a real
 * project behaves the same way.
 */

process.env.SUPABASE_SECRET_KEY ||= "sb_secret_test_placeholder_not_a_credential";
process.env.VITE_SUPABASE_URL ||= "https://fmlwzxmjrecbtvgraqqm.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY ||= "sb_publishable_test_placeholder";
