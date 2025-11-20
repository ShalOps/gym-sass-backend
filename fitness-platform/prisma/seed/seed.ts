// /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Wrapped the entire seeding logic inside a transaction for atomicity.
  await prisma.$transaction(async (tx) => {
    // Delete in reverse dependency order
    await tx.paymentLog.deleteMany({});
    await tx.gymClassReviewResponse.deleteMany({});
    await tx.gymClassReview.deleteMany({});
    await tx.gymReviewResponse.deleteMany({});
    await tx.gymReview.deleteMany({});
    await tx.payment.deleteMany({});
    await tx.serviceBooking.deleteMany({});
    await tx.classBooking.deleteMany({});
    await tx.serviceOptionAssignment.deleteMany({});
    await tx.serviceOption.deleteMany({});
    await tx.service.deleteMany({});
    await tx.gymClasses.deleteMany({});
    await tx.photo.deleteMany({});
    await tx.gym.deleteMany({});
    await tx.user.deleteMany({});

    // Reset sequences to restart IDs from 1
    await tx.$executeRaw`ALTER SEQUENCE "User_userId_seq" RESTART WITH 1;`;
    await tx.$executeRaw`ALTER SEQUENCE "Gym_gymId_seq" RESTART WITH 1;`;
    await tx.$executeRaw`ALTER SEQUENCE "Service_serviceId_seq" RESTART WITH 1;`;
    await tx.$executeRaw`ALTER SEQUENCE "ServiceOption_optionId_seq" RESTART WITH 1;`;
    await tx.$executeRaw`ALTER SEQUENCE "ServiceOptionAssignment_optionAssignmentId_seq" RESTART WITH 1;`;
    await tx.$executeRaw`ALTER SEQUENCE "GymClasses_classId_seq" RESTART WITH 1;`;
    await tx.$executeRaw`ALTER SEQUENCE "Photo_id_seq" RESTART WITH 1;`;
    await tx.$executeRaw`ALTER SEQUENCE "ClassBooking_classBookingId_seq" RESTART WITH 1;`;
    await tx.$executeRaw`ALTER SEQUENCE "ServiceBooking_serviceBookingId_seq" RESTART WITH 1;`;
    await tx.$executeRaw`ALTER SEQUENCE "GymReview_id_seq" RESTART WITH 1;`;
    await tx.$executeRaw`ALTER SEQUENCE "GymReviewResponse_responseId_seq" RESTART WITH 1;`;
    await tx.$executeRaw`ALTER SEQUENCE "GymClassReview_id_seq" RESTART WITH 1;`;
    await tx.$executeRaw`ALTER SEQUENCE "GymClassReviewResponse_responseId_seq" RESTART WITH 1;`;
    await tx.$executeRaw`ALTER SEQUENCE "payments_id_seq" RESTART WITH 1;`;

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
    const gyms: Awaited<ReturnType<typeof tx.gym.create>>[] = [];
    for (let i = 1; i <= 10; i++) {
      const gymOwners = users.filter((u) => u.role === 'GYMOWNER');
      const owner = gymOwners[i % gymOwners.length] || users[0]; // Fallback

      const gym = await tx.gym.create({
        data: {
          gymName: `Gym${i}`,
          contactNo: i % 3 === 0 ? null : `987654321${i}`,
          location: `City${i}`,
          workingHours: i % 2 === 0 ? '9AM-9PM' : null,
          verified: i % 4 !== 0, // Some unverified
          gymOwnerId: owner.userId,
        },
      });
      gyms.push(gym);
    }

    // Seed photos for gyms
    for (const gym of gyms) {
      const photos: Awaited<ReturnType<typeof tx.photo.create>>[] = [];
      for (let k = 1; k <= 3; k++) {
        const photo = await tx.photo.create({
          data: {
            url: `https://example.com/gym${gym.gymId}-photo${k}.jpg`,
            entityType: 'GYM',
            entityId: gym.gymId,
            isCover: k === 1,
          },
        });
        photos.push(photo);
      }
      await tx.gym.update({
        where: { gymId: gym.gymId },
        data: { coverPhotoId: photos.find((p) => p.isCover)?.id },
      });
    }

    // Seed services for each gym
    const services: Awaited<ReturnType<typeof tx.service.create>>[] = [];
    const categories = ['STRENGTH', 'CARDIO', 'CROSSFIT', 'YOGA'] as const;
    for (const gym of gyms) {
      for (let j = 1; j <= 3; j++) {
        // 3 services per gym
        const service = await tx.service.create({
          data: {
            name: `Service${gym.gymId}-${j}`,
            price: 50 + j * 10, // Vary prices
            duration: j % 2 === 0 ? 'Monthly' : 'Yearly',
            category: categories[j % 4],
            target: `Target for ${categories[j % 4]}`,
            gymId: gym.gymId,
          },
        });
        services.push(service);
      }
    }

    // Seed service options for each gym
    const serviceOptions: Awaited<
      ReturnType<typeof tx.serviceOption.create>
    >[] = [];
    for (const gym of gyms) {
      for (let j = 1; j <= 2; j++) {
        // 2 options per gym
        const option = await tx.serviceOption.create({
          data: {
            name: `Option${gym.gymId}-${j}`,
            gymId: gym.gymId,
          },
        });
        serviceOptions.push(option);
      }
    }

    // Seed service option assignments
    for (const service of services) {
      const gymOptions = serviceOptions.filter(
        (o) => o.gymId === service.gymId,
      );
      for (const option of gymOptions) {
        await tx.serviceOptionAssignment.create({
          data: {
            serviceId: service.serviceId,
            optionId: option.optionId,
            gymId: service.gymId,
          },
        });
      }
    }

    // Seed gym classes
    const trainers = users.filter((u) => u.role === 'TRAINER');
    const gymClasses: Awaited<ReturnType<typeof tx.gymClasses.create>>[] = [];
    for (const gym of gyms) {
      for (let j = 1; j <= 2; j++) {
        // 2 classes per gym
        const trainer = trainers[(gym.gymId + j) % trainers.length] || users[0];
        const gymClass = await tx.gymClasses.create({
          data: {
            className: `Class${gym.gymId}-${j}`,
            price: 20 + j * 5,
            classSchedule: `Schedule ${j}`,
            capacity: 10 + j,
            duration: `${60 + j * 10} minutes`,
            gymId: gym.gymId,
            trainerId: trainer.userId,
          },
        });
        gymClasses.push(gymClass);
      }
    }

    // Seed photos for gym classes
    for (const gymClass of gymClasses) {
      const photos: Awaited<ReturnType<typeof tx.photo.create>>[] = [];
      for (let k = 1; k <= 2; k++) {
        const photo = await tx.photo.create({
          data: {
            url: `https://example.com/class${gymClass.classId}-photo${k}.jpg`,
            entityType: 'CLASS',
            entityId: gymClass.classId,
            isCover: k === 1,
          },
        });
        photos.push(photo);
      }
      await tx.gymClasses.update({
        where: { classId: gymClass.classId },
        data: { coverPhotoId: photos.find((p) => p.isCover)?.id },
      });
    }

    // Seed class bookings
    const customers = users.filter((u) => u.role === 'CUSTOMER');
    for (const gymClass of gymClasses) {
      const numBookings = Math.min(3, customers.length); // Up to 3 bookings per class
      for (let b = 0; b < numBookings; b++) {
        const customer = customers[(gymClass.classId + b) % customers.length];
        const booking = await tx.classBooking.create({
          data: {
            userId: customer.userId,
            classId: gymClass.classId,
            status: b % 2 === 0 ? 'CONFIRMED' : 'PENDING',
            bookedAt: new Date(),
            startTime: new Date(Date.now() + (b + 1) * 60 * 60 * 1000), // Future times
            endTime: new Date(Date.now() + (b + 2) * 60 * 60 * 1000),
            notes: b % 3 === 0 ? `Note for booking ${b}` : null,
          },
        });

        const status =
          b % 3 === 0 ? 'PROCESSED' : b % 3 === 1 ? 'PAID_MANUAL' : 'PENDING';
        const method =
          b % 3 === 0 ? 'telebirr' : b % 3 === 1 ? 'MANUAL_CASH' : null;

        const payment = await tx.payment.create({
          data: {
            txRef: `tx-class-${booking.classBookingId}-${Date.now()}-${b}`,
            amount: new Prisma.Decimal(gymClass.price),
            currency: 'ETB',
            status: status,
            type: 'BOOKING',
            userId: customer.userId,
            classBookingId: booking.classBookingId,
            customerEmail: customer.email,
            customerFirstName: customer.firstName,
            customerLastName: customer.lastName,
            method: method,
          },
        });

        if (status !== 'PENDING') {
          await tx.paymentLog.create({
            data: {
              paymentId: payment.id,
              action: status === 'PROCESSED' ? 'VERIFY' : 'MANUAL_RECORD',
              details: { seeded: true, method },
            },
          });
        }
      }
    }

    // Seed service bookings
    for (const service of services) {
      const numBookings = Math.min(2, customers.length); // Up to 2 bookings per service
      for (let b = 0; b < numBookings; b++) {
        const customer = customers[(service.serviceId + b) % customers.length];
        const booking = await tx.serviceBooking.create({
          data: {
            userId: customer.userId,
            serviceId: service.serviceId,
            status: b % 2 === 0 ? 'CONFIRMED' : 'PENDING',
            bookedAt: new Date(),
            startTime:
              b % 2 === 0
                ? new Date(Date.now() + (b + 1) * 24 * 60 * 60 * 1000)
                : null, // Some with times
            endTime:
              b % 2 === 0
                ? new Date(Date.now() + (b + 30) * 24 * 60 * 60 * 1000)
                : null,
            notes: b % 3 === 0 ? `Service booking note ${b}` : null,
          },
        });

        const status =
          b % 3 === 0 ? 'PROCESSED' : b % 3 === 1 ? 'PAID_MANUAL' : 'PENDING';
        const method =
          b % 3 === 0 ? 'chapa' : b % 3 === 1 ? 'MANUAL_CASH' : null;

        const payment = await tx.payment.create({
          data: {
            txRef: `tx-service-${booking.serviceBookingId}-${Date.now()}-${b}`,
            amount: new Prisma.Decimal(service.price),
            currency: 'ETB',
            status: status,
            type: 'BOOKING',
            userId: customer.userId,
            serviceBookingId: booking.serviceBookingId,
            customerEmail: customer.email,
            customerFirstName: customer.firstName,
            customerLastName: customer.lastName,
            method: method,
          },
        });

        if (status !== 'PENDING') {
          await tx.paymentLog.create({
            data: {
              paymentId: payment.id,
              action: status === 'PROCESSED' ? 'VERIFY' : 'MANUAL_RECORD',
              details: { seeded: true, method },
            },
          });
        }
      }
    }

    // Seed gym reviews
    for (const gym of gyms) {
      const numReviews = Math.min(5, customers.length);
      for (let r = 0; r < numReviews; r++) {
        const customer = customers[(gym.gymId + r) % customers.length];
        const review = await tx.gymReview.create({
          data: {
            rating: (r % 5) + 1,
            comment: r % 2 === 0 ? `Great gym experience!` : null,
            gymId: gym.gymId,
            userId: customer.userId,
          },
        });
        // Add response for some reviews
        if (r % 3 === 0) {
          await tx.gymReviewResponse.create({
            data: {
              message: `Thank you for your feedback!`,
              reviewId: review.id,
              ownerId: gym.gymOwnerId,
            },
          });
        }
      }
    }

    // Seed class reviews
    for (const gymClass of gymClasses) {
      const numReviews = Math.min(3, customers.length);
      for (let r = 0; r < numReviews; r++) {
        const customer = customers[(gymClass.classId + r) % customers.length];
        const review = await tx.gymClassReview.create({
          data: {
            rating: (r % 5) + 1,
            comment: r % 2 === 0 ? `Excellent class!` : null,
            classId: gymClass.classId,
            userId: customer.userId,
          },
        });
        // Add response for some reviews
        if (r % 2 === 0) {
          await tx.gymClassReviewResponse.create({
            data: {
              message: `We're glad you enjoyed it!`,
              reviewId: review.id,
              trainerId: gymClass.trainerId,
            },
          });
        }
      }
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
