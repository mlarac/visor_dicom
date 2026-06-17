
import * as userService from '../services/userService.js'
export const getProfile = async (req, res) => {
    try {
        const userprofile = await userService.findById(req.session.user.id);
        res.render('user-profile', {
            userprofile,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error al obtener el perfil del usuario' });
    }
};

export const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.session.user.id;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.redirect('/user/user-profile?error=' + encodeURIComponent('Todos los campos son obligatorios.'));
        }

        if (newPassword !== confirmPassword) {
            return res.redirect('/user/user-profile?error=' + encodeURIComponent('La nueva contraseña y su confirmación no coinciden.'));
        }

        if (newPassword.length < 4) {
            return res.redirect('/user/user-profile?error=' + encodeURIComponent('La nueva contraseña debe tener al menos 4 caracteres.'));
        }

        await userService.changePassword(userId, currentPassword, newPassword);

        res.redirect('/user/user-profile?success=' + encodeURIComponent('Contraseña actualizada con éxito.'));
    } catch (error) {
        console.error(error);
        const errorMsg = error.message || 'Error al cambiar la contraseña';
        res.redirect('/user/user-profile?error=' + encodeURIComponent(errorMsg));
    }
}; 