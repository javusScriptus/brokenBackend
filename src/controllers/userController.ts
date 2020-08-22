import passport from 'passport'
import { sendMail } from '../services/nodemailer'
import { generateCryptoToken } from '../services/crypto'
import type { RequestHandler } from 'express'
import { findUserBy, createNewUser, saveUser, generateTokenExpirationTime, findAllUsers, deleteUserBy } from '../services/userService'
import { getConfigVar } from '../services/getConfigVar'
import { bcryptGenerate } from '../services/bcrypt'
import { UserSchemaType } from '../models/UserSchema'

declare global {
  namespace Express {
    interface User extends UserSchemaType {}
  }
}

export const userPostResetEmailPassword: RequestHandler = async (req, res) => {
  try {
    const { token } = req.params
    const newPassword = req.body.resetUserEmailPasswordDataPassword
    const user = await findUserBy({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } })
    if (user) {
      const hashedPassword = await bcryptGenerate({ hashObject: newPassword })
      user.password = hashedPassword
      user.resetToken = undefined
      user.resetTokenExpiration = undefined
      await saveUser({ user })
      res.status(200).send()
    } else {
      throw new Error('User not found')
    }
  } catch {
    res.status(400).send()
  }
}

export const userPostResetPassword: RequestHandler = async (req, res) => {
  try {
    const token = await generateCryptoToken()
    const user = await findUserBy({ email: req.body.resetUserPasswordDataEmail })
    if (user) {
      if (user.loginStrategy === 'local') {
        user.resetToken = token
        user.resetTokenExpiration = generateTokenExpirationTime()
        await saveUser({ user })
        await sendMail({
          emailContent: ` <p>${req.body.emailData1}</p> <p>${req.body.emailData2}</p> <strong><a href="${getConfigVar(
            'NEXT_PUBLIC_APP_PATH'
          )}user/reset/password/${token}">${req.body.emailData3}</a></strong> `,
          emailTo: req.body.resetUserPasswordDataEmail,
          emailFrom: getConfigVar('MAIL_USER'),
          emailSubject: `${req.body.emailDataSubject}`,
        })
        res.status(200).send()
      } else {
        throw new Error('Wrong login strategy')
      }
    } else {
      throw new Error('User not found')
    }
  } catch {
    res.status(400).send()
  }
}

export const userUpdateRoles: RequestHandler = async (req, res) => {
  try {
    const user = await findUserBy({ _id: req.params.id })
    if (user) {
      user.roles = req.body
      await saveUser({ user })
      res.status(200).send()
    } else {
      throw new Error('User not found')
    }
  } catch {
    res.status(400).send()
  }
}

export const registerUser: RequestHandler = async (req, res) => {
  try {
    const { name, email, password } = req.body
    await createNewUser({ name, email, password, userRoles: ['user', 'admin'], loginStrategy: 'local' })
    res.status(200).send()
  } catch {
    res.status(400).send()
  }
}

export const userGetAllUsers: RequestHandler = async (_req, res) => {
  try {
    const users = await findAllUsers()
    const usersToSend = users.map(({ name, email, roles, _id }) => ({ name, email, roles, _id }))
    res.status(200).send(usersToSend)
  } catch {
    res.status(400).send()
  }
}

export const userDeleteUser: RequestHandler = async (req, res) => {
  try {
    await deleteUserBy({ _id: req.params.id })
    res.status(200).send()
  } catch (error) {
    res.status(400).send()
  }
}
export const getUserCredentials: RequestHandler = (req, res, _next) => {
  if (req.user) {
    res.status(200).send({ roles: req.user.roles, expiresIn: getConfigVar('APP_EXPIRATION_TIME') })
  } else {
    res.status(401).send()
  }
}

export const userAuthLocal: RequestHandler = (req, res, next) => {
  passport.authenticate('local', (error, user) => {
    req.logIn(user, (loginError) => {
      if (loginError) {
        res.status(400).json({ action: error })
      } else {
        getUserCredentials(req, res, next)
      }
    })
  })(req, res, next)
}

export const userAuthGoogle: RequestHandler = (req, res, next) => {
  passport.authenticate('google', (error, user) => {
    req.logIn(user, (loginError) => {
      if (loginError) {
        res.redirect(`/?error=${error}`)
      } else {
        res.redirect(`/`)
      }
    })
  })(req, res, next)
}
export const userAuthFacebook: RequestHandler = (req, res, next) => {
  passport.authenticate('facebook', (error, user) => {
    req.logIn(user, (loginError) => {
      if (loginError) {
        res.redirect(`/?error=${error}`)
      } else {
        res.redirect(`/`)
      }
    })
  })(req, res, next)
}

export const userGetLogout: RequestHandler = (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      req.logout()
      res.clearCookie('connect.sid')
      req.session = undefined
      res.status(200).send()
    })
  }
}
