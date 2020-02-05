import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';

import User from '../models/User';
import Appointment from '../models/Appointment';
import File from '../models/File';

import Notification from '../schemas/Notification';

import CancellationMail from '../jobs/CancellationMail';
import Queue from '../../lib/Queue';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const appointments = await Appointment.findAll({
      where: {
        user_id: req.userId,
        canceled_at: null,
      },
      order: ['date'],
      attributes: ['id', 'date', 'past', 'cancelable'],
      limit: 20,
      offset: (page - 1) * 20,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url'],
            },
          ],
        },
      ],
    });

    return res.json(appointments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      date: Yup.date().required(),
      provider_id: Yup.number().required(),
    });

    if (!(await schema.isValid(req.body)))
      return res.status(400).json({ error: 'Valid is fails' });

    const { provider_id, date } = req.body;

    const isProvider = await User.findOne({
      where: {
        id: provider_id,
        provider: true,
      },
    });

    if (!isProvider) {
      return res
        .status(400)
        .json({ error: 'You can only create appoinntments with providers' });
    }

    /**
     * Checkount se a data que o usuario esta passando não esta antes da
     * data atual
     */
    const hourStart = startOfHour(parseISO(date));

    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({ error: 'Past date are not permited ' });
    }

    /**
     *  Se o agendador já não tem um serviço agendado no mesmo horario
     */

    const checkAvailability = await Appointment.findOne({
      where: {
        canceled_at: null,
        provider_id,
        date: hourStart,
      },
    });

    if (checkAvailability) {
      return res
        .status(400)
        .json({ error: 'Appointment date is not available ' });
    }

    /**
     * Checando se o usuario logado e um provider que esta agendando com si mesmo um agendamento
     */

    if (req.userId === provider_id) {
      return res.status(401).json({
        error: 'It is not allowed to schedule a service with yourself ',
      });
    }

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date,
    });

    /**
     * Notificar prestador de serviços
     */
    const user = await User.findByPk(req.userId);
    const formtDate = format(hourStart, "'dia' dd 'de' MMMM', ás' H:mm'h'", {
      locale: pt,
    });

    await Notification.create({
      content: `O agendamento de ${user.name} para o ${formtDate}`,
      user: provider_id,
    });

    return res.json(appointment);
  }

  async destroy(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });

    /**
     * Verificando se ele e dono do agendamento para pode-lo cancelar
     */

    if (appointment.user_id !== req.userId) {
      return res.status(401).json({
        error: "You don't have permission to cancel this appointment.",
      });
    }

    /**
     * Verificar se ele esta duas horas antes para poder cancelar
     */

    const dateWitchSub = subHours(appointment.date, 2);

    if (isBefore(dateWitchSub, new Date())) {
      return res.status(401).json({
        error: 'Yo can only cancel appoitments 2 hours in advance.',
      });
    }

    appointment.canceled_at = new Date();

    await appointment.save();

    /**
     * Context: Onde colocamos todas as variaveis que irão ser usada no templates.
     * Subject: Onde se envia o titulo do E-mail.
     * Template: nome do template usado no enviou do email
     */
    Queue.add(CancellationMail.key, {
      appointment,
    });

    return res.json(appointment);
  }
}

export default new AppointmentController();
