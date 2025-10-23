import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  // Wrapped the entire seeding logic inside a transaction for atomicity.
  await prisma.$transaction(async (tx) => {
    // Delete gyms first (foreign key constraint on user)
    await tx.gym.deleteMany({});
    // Then delete users
    await tx.user.deleteMany({});

    // Reset sequences to restart IDs from 1
    await tx.$executeRaw`ALTER SEQUENCE "Gym_gymId_seq" RESTART WITH 1;`;
    await tx.$executeRaw`ALTER SEQUENCE "User_userId_seq" RESTART WITH 1;`;

    // Array to hold created users
    const users: Awaited<ReturnType<typeof tx.user.create>>[] = [];

    // Seed 50 users sequentially inside transaction
    for (let i = 1; i <= 50; i++) {
      const user = await tx.user.create({
        data: {
          firstName: `User${i}`,
          lastName: `Last${i}`,
          userName: `user${i}`,
          password: 'password123', // Hash in production!
          birthDate: new Date(1990, 0, (i % 28) + 1),
          gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
          email: `user${i}@example.com`,
          phoneNo: `123456789${i}`,
          location: `Location${i}`,
          goal: 'WEIGHTLOSS',
          role: 'CUSTOMER',
        },
      });
      users.push(user);
    }

    const totalUsers = users.length;

    // Seed 50 gyms with complex round-robin diversified gymOwnerId allocation
    for (let i = 1; i <= 50; i++) {
      let ownerIndex: number;

      if (i <= 15) {
        // First 5 users get 3 gyms each (gyms #1-15)
        ownerIndex = Math.floor((i - 1) / 3);
      } else if (i <= 25) {
        // Next 5 users get 2 gyms each (gyms #16-25)
        ownerIndex = 5 + Math.floor((i - 16) / 2);
      } else {
        // Remaining gyms distributed one-to-one cycling over users from index 10 onward
        ownerIndex = 10 + ((i - 26) % (totalUsers - 10));
      }

      await tx.gym.create({
        data: {
          gymName: `Gym${i}`,
          location: `City${i}`,
          verified: true,
          gymOwnerId: users[ownerIndex].userId,
        },
      });
    }
  }); // end transaction

  console.log('Seeding completed successfully within a transaction!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
