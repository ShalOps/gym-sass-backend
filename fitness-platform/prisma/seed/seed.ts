import { PrismaClient } from '@prisma/client';

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

    // Seed 50 users with varied data
    for (let i = 1; i <= 50; i++) {
      const goals = ['WEIGHTLOSS', 'YOGA', 'BODYBUILDING'] as const;
      const roles = ['CUSTOMER', 'ADMIN', 'GYMOWNER', 'TRAINER'] as const;
      const genders = ['MALE', 'FEMALE'] as const;

      const user = await tx.user.create({
        data: {
          firstName: `User${i}`,
          lastName: `Last${i}`,
          userName: `user${i}`,
          password: 'password123', // Hash in production!
          birthDate: new Date(1990 + (i % 10), i % 12, (i % 28) + 1),
          gender: genders[i % 2],
          email: i % 5 === 0 ? null : `user${i}@example.com`, // Some without email
          phoneNo: `123456789${String(i).padStart(2, '0')}`, // Ensure unique
          profilePic: i % 10 === 0 ? `https://example.com/pic${i}.jpg` : null,
          bio: i % 8 === 0 ? `Bio for user ${i}` : null,
          location: `Location${i}`,
          goal: i % 4 === 0 ? null : goals[i % 3], // Some without goal
          role: roles[i % 4],
        },
      });
      users.push(user);
    }

    // Seed 10 gyms with varied data
    for (let i = 1; i <= 10; i++) {
      const gymOwners = users.filter((u) => u.role === 'GYMOWNER');
      const owner = gymOwners[i % gymOwners.length] || users[0]; // Fallback

      await tx.gym.create({
        data: {
          gymName: `Gym${i}`,
          contactNo: i % 3 === 0 ? null : `987654321${i}`,
          location: `City${i}`,
          workingHours: i % 2 === 0 ? '9AM-9PM' : null,
          verified: i % 4 !== 0, // Some unverified
          gymOwnerId: owner.userId,
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