let userModel = require('../schemas/users')
let cartModel = require('../schemas/cart')
let roleModel = require('../schemas/roles')
let bcrypt = require('bcrypt')
let exceljs = require('exceljs')
let crypto = require('crypto')
let mongoose = require('mongoose')
let { sendPasswordMail } = require('../utils/sendMailHandler')
module.exports = {
    CreateAnUser: async function (username, password, email, role, session,
        avatarUrl, fullName, status, loginCount
    ) {
        let newUser = new userModel({
            username: username,
            password: password,
            email: email,
            role: role,
            avatarUrl: avatarUrl,
            fullName: fullName,
            status: status,
            loginCount: loginCount
        })
        await newUser.save({session});
        return newUser;
    },
    QueryByUserNameAndPassword: async function (username, password) {
        let getUser = await userModel.findOne({ username: username });
        if (!getUser) {
            return false;
        }
        if (bcrypt.compareSync(password, getUser.password)) {
            return getUser;
        }
        return false;

    },
    FindUserById: async function (id) {
        return await userModel.findOne({
            _id: id,
            isDeleted: false
        }).populate('role')
    }, FindUserById: async function (id) {
        return await userModel.findOne({
            _id: id,
            isDeleted: false
        }).populate('role')
    },
    FindUserByEmail: async function (email) {
        return await userModel.findOne({
            email: email,
            isDeleted: false
        })
    },
    FindUserByToken: async function (token) {
        let user = await userModel.findOne({
            forgotpasswordToken: token,
            isDeleted: false
        })
        if (!user || user.forgotpasswordTokenExp < Date.now()) {
            return false
        }
        return user
    },
    ImportUsers: async function(filePath) {
        let session = await mongoose.startSession();
        session.startTransaction();
        try {
            const workbook = new exceljs.Workbook();
            await workbook.xlsx.readFile(filePath);
            const worksheet = workbook.worksheets[0];
            
            let importedUsers = [];
            let userRole = await roleModel.findOne({ name: { $regex: /^user$/i } });
            
            for (let i = 2; i <= worksheet.rowCount; i++) {
                let row = worksheet.getRow(i);
                let username = row.getCell(1).value;
                let email = row.getCell(2).value;
                
                if (!username || !email) continue;
                
                username = username.toString();
                if (typeof email === 'object') {
                    email = email.text || email.hyperlink;
                } else {
                    email = email.toString();
                }
                
                let password = crypto.randomBytes(8).toString('hex'); // 16 characters string
                
                // Create user
                let newUser = new userModel({
                    username: username,
                    password: password,
                    email: email,
                    role: userRole ? userRole._id : null,
                    avatarUrl: "https://i.sstatic.net/l60Hf.png",
                    fullName: "",
                    status: false,
                    loginCount: 0
                });
                await newUser.save({ session });
                
                // Create cart
                let newCart = new cartModel({
                    user: newUser._id
                });
                await newCart.save({ session });
                
                // Send email
                await sendPasswordMail(email, password);
                
                importedUsers.push(newUser);
            }
            
            await session.commitTransaction();
            session.endSession();
            return importedUsers;
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            throw err;
        }
    }
}