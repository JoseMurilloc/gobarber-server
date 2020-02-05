import multer from 'multer';
import crypto from 'crypto';

import { extname, resolve } from 'path';

export default {
  storage: multer.diskStorage({
    destination: resolve(__dirname, '..', '..', 'tmp', 'uploads'),
    filename: (req, file, cb) => {
      // Basicamente e como iremos formatar o nome de arquivo da imagem
      crypto.randomBytes(16, (err, res) => {
        if (err) return cb(err);

        /**
         * Retornando null onde fica o erro
         * Convertendo para texto em formato de hexadecimal
         * Para evitar que nome original tenha caracteres estranhos pegasse somente a extenssão
         */
        return cb(null, res.toString('hex') + extname(file.originalname));
      });
    },
  }),
};
