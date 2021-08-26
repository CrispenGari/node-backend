"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserResolver = void 0;
const type_graphql_1 = require("type-graphql");
const User_1 = require("../entities/User");
const argon2_1 = __importDefault(require("argon2"));
const uuid_1 = require("uuid");
const utils_1 = require("../utils");
const inputTypes_1 = require("./inputTypes");
const objectTypes_1 = require("./objectTypes");
const ONE_HOUR = 60 * 60;
let UserResolver = class UserResolver {
    user({ em, req }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.session.userId) {
                return null;
            }
            const user = yield em.findOne(User_1.User, {
                id: req.session.userId,
            });
            return user;
        });
    }
    register({ em, req }, user) {
        return __awaiter(this, void 0, void 0, function* () {
            if (user.username.length <= 3) {
                return {
                    error: {
                        message: "username must have at least 3 characters",
                        name: "username",
                    },
                };
            }
            if (user.password.length <= 3) {
                return {
                    error: {
                        message: "password must have at least 3 characters",
                        name: "password",
                    },
                };
            }
            const hashed = yield argon2_1.default.hash(user.password);
            const _user = em.create(User_1.User, {
                email: user.email.toLocaleLowerCase(),
                password: hashed,
                username: user.username.toLocaleLowerCase(),
            });
            try {
                yield em.persistAndFlush(_user);
            }
            catch (error) {
                if (error.code === "23505" ||
                    String(error.detail).includes("already exists")) {
                    return {
                        error: {
                            message: "username is taken by someone else",
                            name: "username",
                        },
                    };
                }
            }
            req.session.userId = _user.id;
            return { user: _user };
        });
    }
    login({ em, req }, user) {
        return __awaiter(this, void 0, void 0, function* () {
            const _userFound = yield em.findOne(User_1.User, {
                username: user.username.toLocaleLowerCase(),
            });
            if (!_userFound) {
                return {
                    error: {
                        message: "username does not exists",
                        name: "username",
                    },
                };
            }
            const compare = yield argon2_1.default.verify(_userFound === null || _userFound === void 0 ? void 0 : _userFound.password, user === null || user === void 0 ? void 0 : user.password);
            if (!Boolean(compare)) {
                return {
                    error: {
                        name: "password",
                        message: "invalid password",
                    },
                };
            }
            else {
                req.session.userId = _userFound.id;
                return { user: _userFound };
            }
        });
    }
    logout({ req, res }) {
        return new Promise((resolved, rejection) => {
            req.session.destroy((error) => {
                res.clearCookie("user");
                if (error) {
                    return rejection(false);
                }
                return resolved(true);
            });
        });
    }
    sendEmail(email, { redis, em }) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield em.findOne(User_1.User, { email: email.toLocaleLowerCase() });
            if (!user) {
                return {
                    error: {
                        name: "email",
                        message: `There's no account corresponding to ${email}.`,
                    },
                };
            }
            const token = uuid_1.v4() + uuid_1.v4();
            yield redis.setex(token, ONE_HOUR, String(user.id));
            const message = `Click <a href="http://localhost:3000/reset-password/${token}">here</a> to reset your password.`;
            yield utils_1.sendEmail(email, message);
            return {
                message: `We have sent the password reset link to ${email}. Please reset your password and login again.`,
            };
        });
    }
    resetPassword(emailInput, { redis, em }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (emailInput.newPassword.length <= 3) {
                return {
                    error: {
                        message: "password must have at least 3 characters",
                        name: "password",
                    },
                };
            }
            const userId = yield redis.get(emailInput.token);
            if (userId === null) {
                return {
                    error: {
                        name: "token",
                        message: "could not find the token. maybe it has expired",
                    },
                };
            }
            const user = yield em.findOne(User_1.User, {
                id: Number.parseInt(userId),
            });
            if (user === null) {
                return {
                    error: {
                        name: "user",
                        message: "the user was not found maybe the account was deleted",
                    },
                };
            }
            if (user) {
                user.password = yield argon2_1.default.hash(emailInput.newPassword.toLocaleLowerCase());
                yield redis.del(emailInput.token);
                yield em.persistAndFlush(user);
            }
            return {
                user: user,
            };
        });
    }
};
__decorate([
    type_graphql_1.Query(() => User_1.User, { nullable: true }),
    __param(0, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "user", null);
__decorate([
    type_graphql_1.Mutation(() => objectTypes_1.UserResponse),
    __param(0, type_graphql_1.Ctx()),
    __param(1, type_graphql_1.Arg("user", () => inputTypes_1.UserInput, { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, inputTypes_1.UserInput]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "register", null);
__decorate([
    type_graphql_1.Mutation(() => objectTypes_1.UserResponse),
    __param(0, type_graphql_1.Ctx()),
    __param(1, type_graphql_1.Arg("user", () => inputTypes_1.UserInput, { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, inputTypes_1.UserInput]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "login", null);
__decorate([
    type_graphql_1.Mutation(() => Boolean),
    __param(0, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "logout", null);
__decorate([
    type_graphql_1.Mutation(() => objectTypes_1.Email),
    __param(0, type_graphql_1.Arg("email", () => String)),
    __param(1, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "sendEmail", null);
__decorate([
    type_graphql_1.Mutation(() => objectTypes_1.UserResponse, { nullable: true }),
    __param(0, type_graphql_1.Arg("emailInput", () => inputTypes_1.ResetInput)),
    __param(1, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inputTypes_1.ResetInput, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "resetPassword", null);
UserResolver = __decorate([
    type_graphql_1.Resolver()
], UserResolver);
exports.UserResolver = UserResolver;
//# sourceMappingURL=user.js.map