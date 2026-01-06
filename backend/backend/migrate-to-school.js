// Скрипт миграции: переделка под школу
// Создает классы 1А-11В и распределяет студентов

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateToSchool() {
  try {
    console.log('Начинаем миграцию на школьную систему...');

    // 1. Получаем всех студентов
    const allStudents = await prisma.student.findMany({
      include: { group: true }
    });
    console.log(`Найдено студентов: ${allStudents.length}`);

    // 2. Создаем классы: 1А, 1Б, 1В... 11А, 11Б, 11В
    const classes = [];
    const letters = ['А', 'Б', 'В'];
    const currentYear = new Date().getFullYear();
    
    // Нужна хотя бы одна специальность для создания групп
    let specialty = await prisma.specialty.findFirst();
    if (!specialty) {
      // Создаем дефолтную специальность для школы
      specialty = await prisma.specialty.create({
        data: {
          code: 'SCHOOL',
          name: 'Школьное образование',
          durationYears: 11
        }
      });
      console.log('Создана специальность для школы');
    }

    for (let grade = 1; grade <= 11; grade++) {
      for (const letter of letters) {
        const className = `${grade}${letter}`;
        classes.push({
          name: className,
          grade: grade,
          letter: letter
        });
      }
    }

    console.log(`Создаем ${classes.length} классов...`);

    // Создаем классы в БД
    const createdClasses = [];
    for (const classData of classes) {
      // Проверяем, существует ли уже такой класс
      const existing = await prisma.group.findUnique({
        where: { name: classData.name }
      });

      if (!existing) {
        const newClass = await prisma.group.create({
          data: {
            name: classData.name,
            admissionYear: currentYear - classData.grade + 1, // Примерный год поступления
            course: classData.grade,
            specialtyId: specialty.id
          }
        });
        createdClasses.push(newClass);
        console.log(`Создан класс: ${classData.name}`);
      } else {
        createdClasses.push(existing);
        console.log(`Класс ${classData.name} уже существует`);
      }
    }

    console.log(`Всего классов: ${createdClasses.length}`);

    // 3. Распределяем студентов по классам случайным образом
    // Перемешиваем студентов
    const shuffledStudents = [...allStudents].sort(() => Math.random() - 0.5);
    
    let studentIndex = 0;
    const studentsPerClass = 25; // Минимум 25 студентов на класс
    const maxStudentsPerClass = 30; // Максимум 30 студентов на класс

    for (const classGroup of createdClasses) {
      // Определяем количество студентов для этого класса (25-30)
      const count = Math.floor(Math.random() * (maxStudentsPerClass - studentsPerClass + 1)) + studentsPerClass;
      
      // Берем студентов для этого класса
      const studentsForClass = shuffledStudents.slice(studentIndex, studentIndex + count);
      studentIndex += count;

      // Обновляем groupId для студентов
      for (const student of studentsForClass) {
        await prisma.student.update({
          where: { id: student.id },
          data: { groupId: classGroup.id }
        });
      }

      console.log(`Класс ${classGroup.name}: распределено ${studentsForClass.length} студентов`);
      
      // Если студентов больше нет, выходим
      if (studentIndex >= shuffledStudents.length) {
        break;
      }
    }

    // Лишних студентов (если есть) просто не трогаем - они останутся в старых группах
    // В интерфейсе мы будем показывать только студентов из новых классов
    const remainingStudents = shuffledStudents.length - studentIndex;
    if (remainingStudents > 0) {
      console.log(`Внимание: ${remainingStudents} студентов остались без класса (будут скрыты в интерфейсе)`);
    }

    console.log('Миграция завершена успешно!');
  } catch (error) {
    console.error('Ошибка миграции:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем миграцию
migrateToSchool()
  .then(() => {
    console.log('Миграция завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Ошибка:', error);
    process.exit(1);
  });

