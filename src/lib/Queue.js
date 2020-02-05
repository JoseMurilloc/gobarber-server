import Bee from 'bee-queue';
import CancellationMail from '../app/jobs/CancellationMail';
import redisConfig from '../config/redis';
/**
 * Anotações: Cada tipo de enviou de e-mail tem uma fila específica de acordo com seu trabalho por exemplo:
 * Um e-mail de recuperação de senha vai em uma fila já um e-mail de aviso de cancelamento de serviço vai em outra fila
 */

const jobs = [CancellationMail];

class Queue {
  constructor() {
    this.queues = {};

    this.init();
  }

  /**
   * Parte de inicialização das filas, no queue iremos importar uma serie de 'jobs' no lugar de 'models'.
   * Todas as filas teram trabalhos(jobs) nelas.
   * 'Jobs' é os trabalhos em segundo plano.
   */
  init() {
    jobs.forEach(({ key, handle }) => {
      this.queues[key] = {
        bee: new Bee(key, {
          redis: redisConfig,
        }),
        handle,
      };
    });
  }

  /**
   * Adcininar os jobs em sua fila
   * @param {*} queue Qual fila eu quero adicionar um novo trabalho(job)
   * @param {*} job Os dados do trabalho(job) em si
   */
  add(queue, job) {
    return this.queues[queue].bee.createJob(job).save();
  }

  processoQueue() {
    jobs.forEach(job => {
      const { bee, handle } = this.queues[job.key];

      bee.on('failed', this.handleFaileru).process(handle);
    });
  }

  handleFaileru(job, err) {
    console.log(`Queue ${job.queue.name}: ${err}`);
  }
}

export default new Queue();
