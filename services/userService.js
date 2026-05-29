import { User } from '../models/index.js';
import bcrypt from 'bcrypt';

export const findById = async (id) => {
    try {
        return await User.findByPk(id);
    } catch (error) {
        throw error;
    }
};

export const changePassword = async (id, currentPassword, newPassword) => {
    try {
        const user = await User.findByPk(id);
        if (!user) {
            throw new Error('Usuario no encontrado');
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            throw new Error('La contraseña actual es incorrecta');
        }

        user.password = newPassword;
        await user.save(); // Esto disparará el hook beforeUpdate de Sequelize
        return user;
    } catch (error) {
        throw error;
    }
};

