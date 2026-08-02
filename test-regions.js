const { PrismaClient } = require('@prisma/client');
const regions = ['ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2', 'ap-south-1', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-west-2', 'eu-central-1', 'sa-east-1', 'ca-central-1'];

(async () => {
  for (const r of regions) {
    const url = `postgresql://postgres.xqysclaarffkeyhicbtx:Lamvykiet130110%40@aws-0-${r}.pooler.supabase.com:6543/postgres?pgbouncer=true`;
    console.log('Testing', url);
    const p = new PrismaClient({ datasourceUrl: url });
    try {
      await p.transaction.findFirst();
      console.log('SUCCESS REGION:', r);
      process.exit(0);
    } catch (e) {
      console.log('FAILED:', r);
    }
  }
  console.log('ALL FAILED');
  process.exit(1);
})();
